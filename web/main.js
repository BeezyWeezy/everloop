document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('test-post');
    btn.addEventListener('click', async () => {
        const testData = {
            id: 123456,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            hash: 'testhash',
            auth_date: Math.floor(Date.now() / 1000)
        };
        try {
            const res = await fetch('/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
            const data = await res.json();
            console.log('Manual POST response:', data);
            alert(JSON.stringify(data));
        } catch (err) {
            console.error('POST error:', err);
            alert('POST failed');
        }
    });
});
