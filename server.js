<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>Скоротіть посилання</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      background-color: #111;
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      background: #222;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(255, 208, 87, 0.2);
      width: 100%;
      max-width: 500px;
      text-align: center;
    }
    input, button {
      width: 100%;
      padding: 10px;
      margin: 10px 0;
      border-radius: 6px;
      border: none;
      font-size: 16px;
    }
    input {
      background-color: #333;
      color: #fff;
    }
    button {
      background-color: #FFD057;
      color: #000;
      font-weight: bold;
      cursor: pointer;
    }
    #stats-btn {
      display: none;
      background-color: #444;
      color: #fff;
    }
    #result {
      background-color: #fff;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Скоротіть посилання</h2>
    <form id="shortener-form">
      <input type="url" name="url" placeholder="Вставте ваше посилання" required />
      <input type="text" name="alias" placeholder="Бажаний код (необов’язково)" />
      <button type="submit">Скоротити</button>
    </form>
    <input id="result" readonly placeholder="Тут з'явиться коротке посилання" />
    <button id="stats-btn">Переглянути статистику</button>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('shortener-form');
    const urlInput = document.querySelector('input[name="url"]');
    const aliasInput = document.querySelector('input[name="alias"]');
    const resultInput = document.getElementById('result');
    const statsBtn = document.getElementById('stats-btn');

    let lastCode = '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = urlInput.value.trim();
      const alias = aliasInput.value.trim();

      if (!url) {
        alert('Введіть посилання');
        return;
      }

      try {
        const response = await fetch('https://url-api.onrender.com/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodeURIComponent(url)}&custom=${encodeURIComponent(alias)}`
        });

        const text = await response.text();
        if (!response.ok) throw new Error(text);

        resultInput.value = text;
        lastCode = text.split('/').pop();
        statsBtn.style.display = 'block';
      } catch (err) {
        alert('Помилка скорочення посилання. Спробуйте ще раз.');
        console.error(err);
      }
    });

    statsBtn.addEventListener('click', () => {
      if (lastCode) {
        window.open(`https://url-api.onrender.com/${lastCode}/stats`, '_blank');
      }
    });
  });
  </script>
</body>
</html>
