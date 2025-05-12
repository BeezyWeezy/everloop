(function(){
    let ws;

    function connectWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'auth_status' && data.status === 'logged_out') {
                window.location.href = '/';
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(connectWebSocket, 5000);
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
