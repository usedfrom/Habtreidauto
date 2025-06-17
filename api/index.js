const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Конфигурация GitHub API
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ВАШ_ЛОГИН'; // Замените на ваш GitHub логин
const REPO_NAME = 'geo-pdf-tracker'; // Замените на имя вашего репозитория
const FILE_PATH = 'locations.json'; // Путь к файлу в репозитории

// Проверка доступности маршрута
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API is working' });
});

// Маршрут для сохранения геолокации
app.post('/save-location', async (req, res) => {
    console.log('Received request to /save-location:', req.body); // Отладка

    if (!GITHUB_TOKEN) {
        console.error('GitHub token not configured');
        return res.status(500).json({ success: false, error: 'GitHub token not configured' });
    }

    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
        console.error('Invalid coordinates:', req.body);
        return res.status(400).json({ success: false, error: 'Invalid coordinates' });
    }

    const timestamp = new Date().toISOString();
    const locationData = { latitude, longitude, timestamp };

    try {
        // Получаем текущий файл locations.json из репозитория
        let sha;
        let locations = [];
        try {
            const response = await axios.get(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            locations = JSON.parse(content);
            sha = response.data.sha;
        } catch (err) {
            if (err.response && err.response.status === 404) {
                locations = [];
            } else {
                throw err;
            }
        }

        // Добавляем новые данные
        locations.push(locationData);

        // Обновляем файл в репозитории
        await axios.put(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            {
                message: `Update locations.json with new geolocation data at ${timestamp}`,
                content: Buffer.from(JSON.stringify(locations, null, 2)).toString('base64'),
                sha: sha,
            },
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        console.log('Locations saved to GitHub:', locationData); // Отладка
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения:', err.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера: ' + err.message });
    }
});

// Обработка несуществующих маршрутов
app.use((req, res) => {
    console.error('Route not found:', req.url); // Отладка
    res.status(404).json({ success: false, error: 'Route not found' });
});

module.exports = app;
