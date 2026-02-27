// Platzhalter für deinen Terminerinnerungs-Endpunkt
module.exports = (req, res) => {
  // Einfacher Text, damit wir sehen, dass die Function läuft
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  // Kleiner Test: wir lesen einen Query-Parameter ?name=...
  const url = new URL(req.url, 'http://dummy');
  const name = url.searchParams.get('name') || 'Patient';

  res.end(JSON.stringify({
    message: `Hallo ${name}, dies ist dein Reminder-Endpunkt. Hier wird später der Anruf ausgelöst.`
  }));
};
