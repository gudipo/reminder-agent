// api/cal-reminder-webhook.js
//
// Nimmt Webhooks von Cal.com entgegen und ruft dann
// deine bestehende api/reminder-call-Function auf,
// um den ElevenLabs+Twilio-Call auszulösen.

module.exports = async (req, res) => {
  // 1) Nur POST erlauben (Cal.com sendet POST)
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({ success: false, message: 'Only POST method is allowed' }),
    );
  }

  // 2) Body einlesen (Vercel parst JSON automatisch, falls Content-Type: application/json)
  const body = req.body || {};

  const triggerEvent = body.triggerEvent;
  const payload = body.payload;

  if (!triggerEvent || !payload) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        message: 'Invalid webhook payload: triggerEvent or payload missing',
        receivedBody: body,
      }),
    );
  }

  // Wir starten erstmal nur mit neuen Buchungen
  if (triggerEvent !== 'BOOKING_CREATED') {
    // Für andere Events tun wir (noch) nichts
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: true,
        message: `Ignoring triggerEvent=${triggerEvent}`,
      }),
    );
  }

  // 3) Relevante Daten aus dem Payload lesen
  const startTime = payload.startTime; // ISO-String, z.B. "2026-03-01T09:30:00.000Z"
  const attendees = payload.attendees || [];
  const firstAttendee = attendees[0] || {};

  const name =
    firstAttendee.name ||
    (payload.responses &&
      payload.responses.name &&
      payload.responses.name.value) ||
    'Patient';

  // Telefonnummer an verschiedenen möglichen Stellen suchen:
  let phone =
    firstAttendee.phoneNumber || // Standard-Feld laut Cal.com-API
    firstAttendee.phone || // falls anders benannt
    (payload.responses &&
      payload.responses.phone &&
      payload.responses.phone.value) || // falls du ein benutzerdefiniertes Feld "phone" nutzt
    (payload.responses &&
      payload.responses.phone_number &&
      payload.responses.phone_number.value) ||
    null;

  if (!phone) {
    // Ohne Telefonnummer können wir keinen Call machen
    console.warn('No phone number found in Cal.com payload', payload);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        message: 'No phone number found in booking payload',
      }),
    );
  }

  // 4) Datum und Uhrzeit aus startTime ableiten
  let appointmentDate = null;
  let appointmentTime = null;

  if (startTime) {
    const start = new Date(startTime);

    // NEU: Abstand in Tagen bis zum Termin berechnen
    const now = new Date();
    const msDiff = start.getTime() - now.getTime();
    const daysDiff = msDiff / (1000 * 60 * 60 * 24);

    // NEU: Wenn Termin heute oder morgen ist -> keinen Anruf auslösen
    if (daysDiff < 2) {
      console.log(
        'Skipping reminder call because appointment is too soon. daysDiff=',
        daysDiff,
      );

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          skipped: true,
          reason:
            'Appointment is today or tomorrow - quick logic: no immediate call',
        }),
      );
    }

    // Wie bisher: Datum/Uhrzeit für den Agenten setzen
    appointmentDate = start.toISOString().slice(0, 10); // YYYY-MM-DD
    appointmentTime = start.toISOString().slice(11, 16); // HH:MM (UTC!)
  }

  // Optional: Typ und Ort aus dem Payload (falls verfügbar)
  const appointmentType =
    payload.eventType || payload.title || 'Zahnarzttermin';
  const practiceLocation = payload.location || null;

  // 5) URL zu deiner bestehenden reminder-call-Function bauen
  const baseUrl =
    process.env.REMINDER_BASE_URL ||
    'https://reminder-agent-eight.vercel.app'; // Fallback, falls ENV nicht gesetzt

  const url = new URL('/api/reminder-call', baseUrl);

  // Query-Parameter setzen (wie beim manuellen Test)
  url.searchParams.set('name', name);
  url.searchParams.set('phone', phone);
  if (appointmentDate) url.searchParams.set('date', appointmentDate);
  if (appointmentTime) url.searchParams.set('time', appointmentTime);
  if (appointmentType)
    url.searchParams.set('appointment_type', appointmentType);
  if (practiceLocation)
    url.searchParams.set('practice_location', practiceLocation);

  try {
    // 6) Deine eigene Reminder-Function aufrufen
    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Error calling /api/reminder-call', data);

      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: false,
          message: 'Failed to trigger reminder call',
          reminderError: data,
        }),
      );
    }

    // 7) Erfolgsfall: alles okay
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: true,
        message: 'Reminder call triggered successfully',
        reminderResponse: data,
      }),
    );
  } catch (err) {
    console.error('Error in cal-reminder-webhook', err);

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        message: 'Internal error in cal-reminder-webhook',
        error: String(err),
      }),
    );
  }
};
