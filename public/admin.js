// simple admin UI script: fetch users & rooms, render, edit/delete
const ADMIN_API = window.BASE_API_URL || window.location.origin;
async function fetchUsers(q) {
  const url = new URL(`${ADMIN_API}/api/admin/users`);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString());
  return res.ok ? (await res.json()).users : [];
}
async function fetchRooms(q) {
  const url = new URL(`${ADMIN_API}/api/admin/rooms`);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString());
  return res.ok ? (await res.json()).rooms : [];
}

function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersList');
  if (!tbody) return;
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.username || ''}</td>
      <td>${u.email || ''}</td>
      <td>${u.role || 'user'}</td>
      <td style="display:flex;gap:6px">
        <button data-id="${u._id}" class="btn-edit-user">Sửa</button>
        <button data-id="${u._id}" class="btn-del-user">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // bind buttons
  tbody.querySelectorAll('.btn-edit-user').forEach(b => b.addEventListener('click', onEditUser));
  tbody.querySelectorAll('.btn-del-user').forEach(b => b.addEventListener('click', onDeleteUser));
}

function renderRoomsTable(rooms) {
  const tbody = document.getElementById('adminRoomsList');
  if (!tbody) return;
  tbody.innerHTML = '';
  rooms.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.name || ''}</td>
      <td>${r.game || ''}</td>
      <td>${r.owner || ''}</td>
      <td>${r.status || ''}</td>
      <td style="display:flex;gap:6px">
        <button data-id="${r._id}" class="btn-edit-room">Sửa</button>
        <button data-id="${r._id}" class="btn-del-room">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit-room').forEach(b => b.addEventListener('click', onEditRoom));
  tbody.querySelectorAll('.btn-del-room').forEach(b => b.addEventListener('click', onDeleteRoom));
}

// Handlers
async function onEditUser(e) {
  const id = e.currentTarget.dataset.id;
  const users = await fetchUsers();
  const u = users.find(x => x._id === id);
  if (!u) return alert('User not found');
  const newUsername = prompt('Username mới', u.username || '');
  if (newUsername === null) return;
  const newEmail = prompt('Email', u.email || '') || u.email;
  try {
    const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, email: newEmail })
    });
    if (!res.ok) return alert('Cập nhật thất bại');
    alert('Cập nhật thành công');
    loadData();
  } catch (err) { console.error(err); alert('Lỗi'); }
}

async function onDeleteUser(e) {
  const id = e.currentTarget.dataset.id;
  if (!confirm('Xác nhận xóa user?')) return;
  try {
    const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Xóa thất bại');
    alert('Đã xóa');
    loadData();
  } catch (err) { console.error(err); alert('Lỗi'); }
}

async function onEditRoom(e) {
  const id = e.currentTarget.dataset.id;
  const rooms = await fetchRooms();
  const r = rooms.find(x => x._id === id);
  if (!r) return alert('Room not found');
  const newName = prompt('Tên phòng', r.name || '') || r.name;
  const newStatus = prompt('Trạng thái', r.status || '') || r.status;
  try {
    const res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, status: newStatus })
    });
    if (!res.ok) return alert('Cập nhật thất bại');
    alert('Cập nhật thành công');
    loadData();
  } catch (err) { console.error(err); alert('Lỗi'); }
}

async function onDeleteRoom(e) {
  const id = e.currentTarget.dataset.id;
  if (!confirm('Xác nhận xóa phòng?')) return;
  try {
    const res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Xóa thất bại');
    alert('Đã xóa');
    loadData();
  } catch (err) { console.error(err); alert('Lỗi'); }
}

async function loadData() {
  try {
    const [users, rooms] = await Promise.all([ fetchUsers(), fetchRooms() ]);
    renderUsersTable(users);
    renderRoomsTable(rooms);
  } catch (err) { console.error('loadData', err); }
}

document.addEventListener('DOMContentLoaded', () => {
  // ensure admin tables exist in admin.html
  loadData();
  // wire search inputs if you add them later
});