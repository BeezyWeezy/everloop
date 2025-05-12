(function(){
    let ws;

    // Check JWT and connect WebSocket on page load
    function checkAuthAndConnect() {
        const cookies = document.cookie.split(';');
        const jwt = cookies.find(c => c.trim().startsWith('jwt='));
        if (jwt) {
            connectWebSocket();
        } else {
            // Redirect only if we're not already on the login page
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
    }
    // Run check on page load
    checkAuthAndConnect();
    function connectWebSocket() {
        if (ws) {
            // Если соединение уже существует и открыто, не создаем новое
            if (ws.readyState === WebSocket.OPEN) return;
            // Если соединение в процессе открытия, тоже выходим
            if (ws.readyState === WebSocket.CONNECTING) return;
        }
        // Отправка запроса на валидацию сессии после установки соединения
        ws = new WebSocket('ws://' + window.location.host);
        const validateSession = () => {
            ws.send(JSON.stringify({ type: 'validate_session' }));
        };

        ws.onopen = () => {
            console.log('WebSocket connected');
            validateSession(); // Проверяем сессию сразу после подключения
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data);
            if (data.type === 'auth_status' && data.status === 'logged_out' ||
                data.type === 'session_status' && data.status === 'invalid') {
                window.location.href = '/';
            }
        };
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Проверяем наличие JWT перед переподключением
            const jwt = document.cookie.split(';').find(c => c.trim().startsWith('jwt='));
            if (jwt) {
                setTimeout(connectWebSocket, 5000);
            }
        };
    }
    window.onTelegramAuth = async function(user) {
        console.log('AUTH DATA >>>', user);
        try {
            const res = await fetch('/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            const data = await res.json();
            console.log('AUTH RESP >>>', data);
            if (data.token) {
                document.getElementById('status').textContent = 'Logged in!';
                connectWebSocket();
                window.location.href = '/dashboard.html';
            } else {
                alert('Auth failed: ' + (data.error || 'unknown'));
                window.location.href = '/';
            }
        } catch (e) {
            console.error('AUTH ERROR', e);
            alert('Network error');
            window.location.href = '/';
        }
    };
})();
