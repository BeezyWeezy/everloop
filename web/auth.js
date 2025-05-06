(function(){
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
            if (data.token) document.getElementById('status').textContent = 'Logged in!';
            else alert('Auth failed: ' + (data.error || 'unknown'));
        } catch (e) {
            console.error('AUTH ERROR', e);
            alert('Network error');
        }
    };
})();