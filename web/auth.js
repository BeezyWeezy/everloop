// Global handler for Telegram Login widget
async function onTelegramAuth(user) {
    const res = await fetch('/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    const data = await res.json();
    if (data.token) {
        document.cookie = `jwt=${data.token};path=/;SameSite=Lax`;
        document.getElementById('status').textContent = 'Logged in!';
    } else {
        alert('Auth failed');
    }
}