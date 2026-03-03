// Terminerinnerungs-Endpunkt: löst einen Outbound-Call über ElevenLabs+Twilio aus.
//
// Testaufruf im Browser (anpassen!):
// https://reminder-agent-eight.vercel.app/api/reminder-call?name=Max&phone=%2B4917621110218&date=2026-03-01&time=10:30

// WICHTIG: Diese URL gleich in Schritt 2.2 aus der ElevenLabs-Doku kopieren
const ELEVENLABS_OUTBOUND_URL =
  'https://api.elevenlabs.io/v1/convai/twilio/outbound-call';

module.exports = async (req, res) => {
  // Für den Start: nur GET erlauben, dann kannst du bequem im Browser testen
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Bitte im Test nur GET verwenden (per Browser-URL).',
      }),
    );
  }

  // Query-Parameter aus der URL lesen
  const url = new URL(req.url, 'http://dummy');
  const name = url.searchParams.get('name') || 'Patient';
  const phone = url.searchParams.get('phone'); // Pflichtfeld
  const date = url.searchParams.get('date') || 'morgen';
  const time = url.searchParams.get('time') || 'UNBEKANNTE UHRZEIT';

  // NEU: optionale zusätzliche Felder für deinen Prompt
  const appointmentType =
    url.searchParams.get('appointment_type') || null;
  const practiceLocation =
    url.searchParams.get('practice_location') || null;

  if (!phone) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error:
          'Bitte Parameter "phone" in der URL mitgeben, z.B. ?phone=+49123456789',
      }),
    );
  }

  // Environment Variables aus Vercel lesen
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!apiKey || !agentId || !agentPhoneNumberId) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error:
          'Server-Konfiguration unvollständig. Bitte ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID und ELEVENLABS_PHONE_NUMBER_ID in Vercel setzen.',
      }),
    );
  }

  try {
    // NEU: Dynamic Variables für deinen Agenten vorbereiten
    const dynamicVariables = {
      // Namen müssen EXAKT zu deinen {{...}} im Prompt passen
      patient_name: name,
      appointment_date: date,
      appointment_time: time,
    };

    if (appointmentType) {
      dynamicVariables.appointment_type = appointmentType;
    }
    if (practiceLocation) {
      dynamicVariables.practice_location = practiceLocation;
    }

    // Request-Body für ElevenLabs vorbereiten.
    // Laut Doku zum Outbound-Call via Twilio:
    // agent_id, agent_phone_number_id und to_number sind Pflichtfelder.
    const body = {
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: phone,
      // NEU: Termindaten an den Agenten übergeben
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
      },
    };

    // API-Call zu ElevenLabs: Authentifizierung per xi-api-key Header.
    const response = await fetch(ELEVENLABS_OUTBOUND_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.statusCode = response.status || 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          error: 'ElevenLabs API hat einen Fehler zurückgegeben.',
          status: response.status,
          details: data,
          // NEU: zum Debuggen – kann bei Bedarf wieder raus
          sentBody: body,
        }),
      );
    }

    // Erfolgsfall
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: true,
        message: `Anruf wird ausgelöst an ${phone} für ${name} (Termin: ${date} um ${time}).`,
        elevenlabsResponse: data,
        // NEU: hilfreich zum Prüfen
        sentBody: body,
      }),
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Technischer Fehler beim Aufruf der ElevenLabs API.',
        details: String(err),
      }),
    );
  }
};
