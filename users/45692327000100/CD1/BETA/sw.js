// Quando o push chega do servidor
self.addEventListener('push', function(event) {
  const data = event.data?.json() || {
    title: 'Nova notificação',
    body: 'Você recebeu uma nova atualização!',
  };

  const options = {
    body: data.body,
    icon: 'alert.png', // Coloque esse ícone na mesma pasta
    badge: 'alert.png' // Também pode ser usado na barra do sistema
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Quando o usuário clica na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // Redireciona ao seu site
  );
});
