window.onTelegramAuth = async (user) => {
    try {
        const res = await fetch('/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(user).toString()
        });
        const data = await res.json();
        if (data.token) document.getElementById('status').textContent = 'Logged in!';
    } catch (e) { console.error(e); }
};