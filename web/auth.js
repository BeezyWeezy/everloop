(function(){
    let ws;

    function connectWebSocket() {
        console.log('Attempting to connect WebSocket...');

        if (ws) {
            console.log('Existing WebSocket state:', ws.readyState);
            // Если соединение уже существует и открыто, не создаем новое
            if (ws.readyState === WebSocket.OPEN) {
                console.log('WebSocket already connected');
                return;
            }
            // Если соединение в процессе открытия, тоже выходим
            if (ws.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket connection in progress');
                return;
            }
        }
        // Отправка запроса на валидацию сессии после установки соединения
        console.log('Creating new WebSocket connection...');
        ws = new WebSocket('ws://' + window.location.host);

        const validateSession = () => {
            console.log('Sending validate_session message');
            const message = JSON.stringify({ type: 'validate_session' });
            ws.send(message);
            console.log('Sent:', message);
        };
        ws.onopen = () => {
            console.log('WebSocket connected successfully');
            validateSession(); // Проверяем сессию сразу после подключения
        };
        ws.onmessage = (event) => {
            console.log('Received WebSocket message:', event.data);
            const data = JSON.parse(event.data);
            console.log('Parsed message')

            if (data.type === 'auth_status' && data.status === 'logged_out' ||
                data.type === 'session_status' && data.status === 'invalid') {
                console.log('Invalid session detected, redirecting to login');
                window.location.href = '/';
            }
        };
        ws.onclose = (event) => {
            console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
            // Проверяем наличие JWT перед переподключением
            const jwt = document.cookie.split(';').find(c => c.trim().startsWith('jwt='));
            if (jwt) {
                console.log('JWT found, attempting reconnection in 5 seconds...');
                setTimeout(connectWebSocket, 5000);
            } else {
                console.log('No JWT found, skipping reconnection');
            }
        };
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

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
