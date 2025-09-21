// ==================================================================
// CALEA: app/admin/setari/utilizatori/page.tsx
// DATA: 21.09.2025 11:15 (ora României)
// DESCRIERE: Management utilizatori Firebase + BigQuery cu UI modern glassmorphism
// FUNCȚIONALITATE: CRUD utilizatori, roluri, permisiuni - toate într-o singură pagină
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner, Modal, Input, Alert } from '@/app/components/ui';
import { toast } from 'react-toastify';

interface User {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: 'admin' | 'normal';
  activ: boolean;
  data_creare: string;
  data_ultima_conectare?: string;
  permisiuni: {
    admin: { read: boolean; write: boolean };
    financiar: { read: boolean; write: boolean };
    proiecte: { read: boolean; write: boolean };
    rapoarte: { read: boolean };
    timp: { read: boolean; write: boolean };
  };
}

interface UserFormData {
  email: string;
  nume: string;
  prenume: string;
  rol: 'admin' | 'normal';
  activ: boolean;
}

const PREDEFINED_PERMISSIONS = {
  admin: {
    admin: { read: true, write: true },
    financiar: { read: true, write: true },
    proiecte: { read: true, write: true },
    rapoarte: { read: true },
    timp: { read: true, write: true }
  },
  normal: {
    admin: { read: false, write: false },
    financiar: { read: false, write: false },
    proiecte: { read: true, write: true },
    rapoarte: { read: true },
    timp: { read: true, write: true }
  }
};

// Helper function pentru formatarea datelor BigQuery
const formatBigQueryDate = (dateField: any): string => {
  if (!dateField) return 'Niciodată';

  // BigQuery returnează { value: "2025-08-16T10:30:00.000Z" }
  const dateString = dateField.value || dateField;

  if (!dateString) return 'Niciodată';

  try {
    return new Date(dateString).toLocaleDateString('ro-RO');
  } catch (error) {
    console.error('Eroare formatare dată:', error, dateField);
    return 'Data invalidă';
  }
};

const ModernUsersPage: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    nume: '',
    prenume: '',
    rol: 'normal',
    activ: true
  });

  // ==================================================================
  // AUTHENTICATION
  // ==================================================================

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const storedRole = localStorage.getItem('userRole') || 'user';
    if (storedRole !== 'admin') {
      toast.error('Accesul la management utilizatori este permis doar pentru admini');
      router.push('/admin');
      return;
    }

    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
    setUserRole(storedRole);
    loadUsers();
  }, [user, loading, router]);

  // ==================================================================
  // DATA LOADING
  // ==================================================================

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch('/api/rapoarte/utilizatori');

      if (!response.ok) {
        throw new Error('Eroare la încărcarea utilizatorilor');
      }

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        throw new Error(data.error || 'Eroare necunoscută');
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorilor:', error);
      toast.error('Nu s-au putut încărca utilizatorii');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // ==================================================================
  // FIREBASE + BIGQUERY OPERATIONS
  // ==================================================================

  const createFirebaseUser = async (email: string): Promise<string> => {
    try {
      const response = await fetch('/api/admin/users/create-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Eroare la crearea utilizatorului în Firebase');
      }

      return data.uid;
    } catch (error) {
      throw new Error(`Firebase Error: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    }
  };

  const addUserToBigQuery = async (userData: UserFormData, uid: string) => {
    const permisiuni = PREDEFINED_PERMISSIONS[userData.rol];

    const response = await fetch('/api/rapoarte/utilizatori', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        email: userData.email,
        nume: userData.nume,
        prenume: userData.prenume,
        rol: userData.rol,
        permisiuni,
        activ: userData.activ
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Eroare la adăugarea în BigQuery');
    }
  };

  const handleAddUser = async () => {
    if (!formData.email || !formData.nume || !formData.prenume) {
      toast.error('Toate câmpurile sunt obligatorii');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create user in Firebase
      const uid = await createFirebaseUser(formData.email);

      // Step 2: Add user to BigQuery
      await addUserToBigQuery(formData, uid);

      toast.success(`Utilizator ${formData.prenume} ${formData.nume} adăugat cu succes! Un email de activare a fost trimis.`);

      // Reset form și refresh data
      setFormData({
        email: '',
        nume: '',
        prenume: '',
        rol: 'normal',
        activ: true
      });
      setShowAddModal(false);
      loadUsers();

    } catch (error) {
      console.error('Eroare la adăugarea utilizatorului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la adăugarea utilizatorului');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/rapoarte/utilizatori', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: selectedUser.uid,
          nume: formData.nume,
          prenume: formData.prenume,
          rol: formData.rol,
          permisiuni: PREDEFINED_PERMISSIONS[formData.rol],
          activ: formData.activ
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Eroare la actualizare');
      }

      toast.success('Utilizator actualizat cu succes');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();

    } catch (error) {
      console.error('Eroare la actualizarea utilizatorului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la actualizarea utilizatorului');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);

    try {
      // Soft delete din BigQuery
      const response = await fetch(`/api/rapoarte/utilizatori?uid=${selectedUser.uid}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Eroare la dezactivare');
      }

      // Delete din Firebase
      await fetch('/api/admin/users/delete-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: selectedUser.uid })
      });

      toast.success('Utilizator șters cu succes');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();

    } catch (error) {
      console.error('Eroare la ștergerea utilizatorului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la ștergerea utilizatorului');
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================================================================
  // FILTER & SEARCH
  // ==================================================================

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.nume_complet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === '' || user.rol === filterRole;

    return matchesSearch && matchesRole;
  });

  // ==================================================================
  // MODAL HANDLERS
  // ==================================================================

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      nume: user.nume,
      prenume: user.prenume,
      rol: user.rol,
      activ: user.activ
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  if (loading) {
    return <LoadingSpinner overlay />;
  }

  if (!user) {
    return null;
  }

  // ==================================================================
  // RENDER
  // ==================================================================

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              👥 Management Utilizatori
            </h1>
            <p className="text-gray-600 text-lg">
              Gestionează utilizatorii, rolurile și permisiunile din Firebase și BigQuery
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/setari')}
            >
              ← Înapoi la Setări
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
            >
              + Adaugă Utilizator
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card variant="default" className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Căutare
            </label>
            <Input
              type="text"
              placeholder="Nume, prenume sau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rol
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Toate rolurile</option>
              <option value="admin">Admin</option>
              <option value="normal">Normal</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={loadUsers}
              disabled={isLoadingUsers}
            >
              🔄 Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card variant="default" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Utilizatori Activi ({filteredUsers.length})
          </h2>
          {isLoadingUsers && <LoadingSpinner />}
        </div>

        {isLoadingUsers ? (
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-gray-500 mt-2">Se încarcă utilizatorii...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-gray-500">Nu există utilizatori care să corespundă filtrelor</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Utilizator</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rol</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Ultima Conectare</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          user.rol === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}>
                          {user.prenume?.[0]}{user.nume?.[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.nume_complet}</div>
                          <div className="text-sm text-gray-500">
                            Creat: {formatBigQueryDate(user.data_creare)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{user.email}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.rol === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.rol === 'admin' ? '👑 Admin' : '👤 Normal'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.activ
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.activ ? '✅ Activ' : '❌ Inactiv'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {formatBigQueryDate(user.data_ultima_conectare)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          ✏️ Editează
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          🗑️ Șterge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Adaugă Utilizator Nou"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prenume *
              </label>
              <Input
                type="text"
                placeholder="Ion"
                value={formData.prenume}
                onChange={(e) => setFormData(prev => ({ ...prev, prenume: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nume *
              </label>
              <Input
                type="text"
                placeholder="Popescu"
                value={formData.nume}
                onChange={(e) => setFormData(prev => ({ ...prev, nume: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rol
            </label>
            <select
              value={formData.rol}
              onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value as 'admin' | 'normal' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="normal">👤 Normal - Accesează proiecte și timp</option>
              <option value="admin">👑 Admin - Acces complet la sistem</option>
            </select>
          </div>

          <Alert type="info">
            Utilizatorul va primi un email de activare pentru a-și seta parola.
          </Alert>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              disabled={isProcessing}
            >
              Anulează
            </Button>
            <Button
              variant="primary"
              onClick={handleAddUser}
              disabled={isProcessing}
              loading={isProcessing}
            >
              Adaugă Utilizator
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Editează ${selectedUser?.nume_complet}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email (nu se poate modifica)
            </label>
            <Input
              type="email"
              value={formData.email}
              disabled
              className="bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prenume
              </label>
              <Input
                type="text"
                value={formData.prenume}
                onChange={(e) => setFormData(prev => ({ ...prev, prenume: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nume
              </label>
              <Input
                type="text"
                value={formData.nume}
                onChange={(e) => setFormData(prev => ({ ...prev, nume: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rol
            </label>
            <select
              value={formData.rol}
              onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value as 'admin' | 'normal' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="normal">👤 Normal</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="activ"
              checked={formData.activ}
              onChange={(e) => setFormData(prev => ({ ...prev, activ: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="activ" className="text-sm font-medium text-gray-700">
              Utilizator activ
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={isProcessing}
            >
              Anulează
            </Button>
            <Button
              variant="primary"
              onClick={handleEditUser}
              disabled={isProcessing}
              loading={isProcessing}
            >
              Salvează Modificările
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmă Ștergerea"
        size="sm"
      >
        <div className="space-y-4">
          <Alert type="warning">
            Ești sigur că vrei să ștergi utilizatorul <strong>{selectedUser?.nume_complet}</strong>?
            <br /><br />
            Această acțiune va:
            <ul className="list-disc list-inside mt-2">
              <li>Dezactiva utilizatorul din BigQuery</li>
              <li>Șterge contul din Firebase</li>
              <li>Nu se poate anula</li>
            </ul>
          </Alert>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isProcessing}
            >
              Anulează
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              disabled={isProcessing}
              loading={isProcessing}
            >
              Da, Șterge Utilizatorul
            </Button>
          </div>
        </div>
      </Modal>
    </ModernLayout>
  );
};

export default ModernUsersPage;