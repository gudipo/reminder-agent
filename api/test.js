// Einfache Test-API für Vercel
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    message: 'Hallo, das ist deine Test-API auf Vercel. Alles läuft!'
  }));
};
