<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Статистика переходів</title>
  <style>
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background: #000;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    h1 {
      color: #FFD057;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      max-width: 1000px;
      border-collapse: collapse;
      background: #1c1c1c;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 0 14px rgba(255, 208, 87, 0.15);
    }
    th, td {
      padding: 14px 18px;
      border-bottom: 1px solid #333;
      text-align: left;
      font-size: 15px;
    }
    th {
      background: #5a441f;
      color: #FFD057;
      font-weight: 600;
    }
    tr:hover td {
      background-color: #2a2a2a;
    }
    .error {
      color: red;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h1>Детальна статистика переходів</h1>
  <table id="stats-table">
    <thead>
      <tr>
        <th>IP</th>
        <th>Країна</th>
        <th>Місто</th>
        <th>Дата</th>
      </tr>
    </thead>
    <tbody>
      <!-- Дані будуть додані через JavaScript -->
    </tbody>
  </table>

  <script>
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    fetch(`/${code}/stats`)
      .then(res => {
        if (!res.ok) throw new Error('Не вдалося отримати дані');
        return res.json();
      })
      .then(data => {
        const tbody = document.querySelector('#stats-table tbody');
        if (!data.details || data.details.length === 0) {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td colspan="4" style="text-align: center; color: #999;">Немає даних для відображення</td>`;
          tbody.appendChild(tr);
          return;
        }

        data.details.forEach(stat => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${stat.ip}</td>
            <td>${stat.country || '-'}</td>
            <td>${stat.city || '-'}</td>
            <td>${new Date(stat.date).toLocaleString('uk-UA')}</td>
          `;
          tbody.appendChild(tr);
        });
      })
      .catch(err => {
        alert('Помилка завантаження статистики');
        console.error(err);
      });
  </script>
</body>
</html>
