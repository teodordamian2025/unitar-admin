const handleLogout = async () => {
  await signOut(auth);

  // Șterge cookie-ul
  document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

  router.push('/login');
};
