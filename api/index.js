export default async function handler(req, res) {
  // Redirect ke index.html
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/index.html">
</head>
<body>
  <script>window.location.href = '/index.html';</script>
</body>
</html>`);
}
