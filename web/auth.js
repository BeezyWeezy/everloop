window.onTelegramAuth = async function (user) {
    console.log('AUTH DATA >>>', user); // debug
    try {
        const body = new URLSearchParams(user).toString();
        fetch('/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
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