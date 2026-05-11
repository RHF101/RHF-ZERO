// Tangkap SEMUA request ke /api
app.all('*', (req, res) => {
  res.json({ 
    status: 'online',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

export default app;
