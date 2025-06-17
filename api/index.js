const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Конфигурация GitHub API
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'habtreidauto'; // Замените на ваш GitHub логин
const REPO_NAME = 'geo-pdf-tracker'; // Замените на имя вашего репозитория
const FILE_PATH = 'locations.json'; // Путь к файлу в репозитории

// Тестовый маршрут для проверки API
app.get('/api/test', (req, res) => {
    console.log('Test route accessed at', new Date().toISOString());
    res.json({ 
        success: true, 
        message: 'API is working', 
        tokenConfigured: !!GITHUB_TOKEN,
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
        filePath: FILE_PATH 
    });
});

// Маршрут для сохранения геолокации
app.post('/api/save-location', async (req, res) => {
    console.log('Received request to /api/save-location at', new Date().toISOString(), 'Body:', req.body);

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
        // Проверяем доступ к репозиторию
        console.log('Checking repository access');
        await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        // Получаем текущий файл locations.json из репозитория
        let sha;
        let locations = [];
        console.log('Fetching locations.json from GitHub');
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
            console.log('GitHub API response:', response.data);
            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            locations = JSON.parse(content);
            sha = response.data.sha;
        } catch (err) {
            if (err.response && err.response.status === 404) {
                console.log('locations.json not found, initializing empty array');
                locations = [];
            } else {
                console.error('GitHub API error:', err.message, err.response?.data);
                throw err;
            }
        }

        // Добавляем новые данные
        locations.push(locationData);
        console.log('New locations data:', locations);

        // Обновляем файл в репозитории
        console.log('Updating locations.json in GitHub');
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

        console.log('Locations saved to GitHub:', locationData);
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения:', err.message, err.response?.data);
        res.status(500).json({ success: false, error: `Ошибка сервера: ${err.message}` });
    }
});

// Обработка несуществующих маршрутов
app.use((req, res) => {
    console.error('Route not found:', req.url, 'at', new Date().toISOString());
    res.status(404).json({ success: false, error: 'Route not found' });
});

module.exports = app;
