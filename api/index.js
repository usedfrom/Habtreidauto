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

// Маршрут для сохранения геолокации
app.post('/save-location', async (req, res) => {
    const { latitude, longitude } = req.body;
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
            sha = response.data.sha; // Получаем SHA для обновления файла
        } catch (err) {
            if (err.response && err.response.status === 404) {
                // Если файл не существует, создадим пустой массив
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
                sha: sha, // Указываем SHA, если файл существует
            },
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

module.exports = app;