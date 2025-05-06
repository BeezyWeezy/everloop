window.onTelegramAuth = async function (user) {
    console.log('AUTH DATA >>>', user); // debug
    try {
        console.log('AUTH DATA >>>', user);          // должен отобразиться объект
        try {
            const res = await fetch('/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(Object.entries(user)).toString()
            });
        const data = await res.json();
        if (data.token) {
            document.cookie = `jwt=${data.token};path=/;SameSite=Lax`;
            document.getElementById('status').textContent = 'Logged in!';
        } else {
            alert('Auth failed');
        }
    } catch (err) {
        console.error('AUTH ERROR', err);
        alert('Server error');
    }
};