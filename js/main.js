/* ========== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ========== */
const state = {
  building: {
    name: 'Моё здание',
    organization: 'Главная организация',
    floors: []
  },
  currentFloor: null,
  selectedRoom: null,
  selectedItem: null,
  gridSize: 20,
  snapToGrid: true,
  draggedRoom: null,
  resizedRoom: null,
  editMode: false,
  colors: [
    '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6',
    '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252',
    '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057'
  ]
};

/* ========== ОСНОВНЫЕ ФУНКЦИИ ========== */

function saveState() {
  const dataToSave = {
    building: state.building,
    currentFloorId: state.currentFloor?.id
  };
  localStorage.setItem('inventoryData', JSON.stringify(dataToSave));
}

function loadFromLocalStorage() {
  const savedData = localStorage.getItem('inventoryData');
  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData);
      state.building = parsedData.building || state.building;
      if (parsedData.currentFloorId) {
        state.currentFloor = state.building.floors.find(f => f.id === parsedData.currentFloorId);
      }
    } catch (e) {
      console.error('Ошибка загрузки:', e);
    }
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/* ========== РАБОТА С ЭТАЖАМИ ========== */

function renderRoomsList(floor) {
  const roomsContainer = document.getElementById(`rooms-${floor.id}`);
  if (!roomsContainer) return;
  roomsContainer.innerHTML = '';
  
  floor.rooms.forEach(room => {
    const roomElement = document.createElement('div');
    roomElement.className = `room-item ${state.selectedRoom?.id === room.id ? 'active' : ''}`;
    roomElement.textContent = room.name;
    roomElement.addEventListener('click', (e) => {
      e.stopPropagation();
      selectRoom(room.id);
    });
    roomsContainer.appendChild(roomElement);
  });
}

function renderFloorsList() {
  const floorsList = document.getElementById('floors-list');
  floorsList.innerHTML = '';

  state.building.floors.forEach(floor => {
    const floorElement = document.createElement('div');
    floorElement.className = `floor-item ${state.currentFloor?.id === floor.id ? 'active' : ''}`;
    floorElement.innerHTML = `
      <h3>${floor.name}</h3>
      <div class="floor-rooms" id="rooms-${floor.id}"></div>
    `;
    floorElement.addEventListener('click', () => selectFloor(floor.id));
    floorsList.appendChild(floorElement);
    renderRoomsList(floor);
  });
}

function selectFloor(floorId) {
  state.currentFloor = state.building.floors.find(f => f.id === floorId);
  document.getElementById('current-floor').textContent = `Текущий этаж: ${state.currentFloor?.name || 'Не выбран'}`;
  renderFloorCanvas();
  saveState();
}

function setupFloorControls() {
  document.getElementById('add-floor').addEventListener('click', () => {
    const floorName = prompt('Название этажа:', `Этаж ${state.building.floors.length + 1}`);
    if (!floorName) return;

    const newFloor = {
      id: `floor-${Date.now()}`,
      name: floorName,
      rooms: []
    };

    state.building.floors.push(newFloor);
    renderFloorsList();
    selectFloor(newFloor.id);
    showNotification('Этаж успешно добавлен');
    saveState();
  });
}

/* ========== РАБОТА С КОМНАТАМИ ========== */

function renderFloorCanvas() {
  const canvas = document.getElementById('floor-canvas');
  canvas.innerHTML = '';
  if (!state.currentFloor) return;

  state.currentFloor.rooms.forEach(room => {
    const roomElement = document.createElement('div');
    roomElement.className = 'room';
    roomElement.dataset.roomId = room.id;
    roomElement.style.cssText = `
      left: ${room.x}px;
      top: ${room.y}px;
      width: ${room.width}px;
      height: ${room.height}px;
      background-color: ${room.color};
      cursor: ${state.editMode ? 'move' : 'pointer'};
    `;
    roomElement.innerHTML = `
      <div class="room-header">
        <span>${room.name}</span>
      </div>
      ${state.editMode ? '<div class="room-resize-handle"></div>' : ''}
    `;
    
    if (state.editMode) {
      roomElement.addEventListener('mousedown', startRoomDrag);
      const handle = roomElement.querySelector('.room-resize-handle');
      if (handle) handle.addEventListener('mousedown', startRoomResize);
    }
    
    roomElement.addEventListener('click', (e) => {
      if (state.editMode) return;
      e.stopPropagation();
      selectRoom(room.id);
      openRoomModal(room);
    });
    
    canvas.appendChild(roomElement);
  });
}

function toggleEditMode() {
  state.editMode = !state.editMode;
  const btn = document.getElementById('edit-room');
  btn.textContent = state.editMode ? 'Завершить редактирование' : 'Редактировать';
  btn.style.backgroundColor = state.editMode ? '#ffc107' : '';
  renderFloorCanvas();
}

function showColorPalette() {
  if (!state.currentFloor) {
    showNotification('Сначала выберите этаж!', 'error');
    return;
  }

  const modal = document.getElementById('color-modal');
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Выберите цвет комнаты</h3>
      <div class="color-palette">
        ${state.colors.map(color => `
          <div class="color-option" style="background-color: ${color}" data-color="${color}"></div>
        `).join('')}
      </div>
      <div class="form-footer">
        <button id="cancel-color">Отмена</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  modal.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
      createNewRoom(this.dataset.color);
      modal.style.display = 'none';
    });
  });
  
  modal.querySelector('#cancel-color').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

function createNewRoom(color) {
  const newRoom = {
    id: `room-${Date.now()}`,
    name: 'Новая комната',
    organization: state.building.organization,
    x: 50,
    y: 50,
    width: 200,
    height: 150,
    color: color,
    items: []
  };

  state.currentFloor.rooms.push(newRoom);
  renderFloorCanvas();
  selectRoom(newRoom.id);
  showNotification('Комната успешно добавлена');
  saveState();
}

function openRoomModal(room) {
  state.selectedRoom = room;
  const modal = document.getElementById('room-modal');
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="room-info">
        <h3>${room.name}</h3>
        <p>Организация: ${room.organization || 'Не указана'}</p>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th>Инв. номер</th>
            <th>Организация</th>
            <th>Комментарий</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody id="items-table-body">
          ${renderItemsRows(room.items)}
        </tbody>
      </table>
      
      <div class="add-item-form">
        <div>
          <label for="new-item-name">Наименование*</label>
          <input type="text" id="new-item-name" required>
        </div>
        <div>
          <label for="new-item-inventory">Инв. номер</label>
          <input type="text" id="new-item-inventory">
        </div>
        <div>
          <label for="new-item-organization">Организация</label>
          <input type="text" id="new-item-organization" value="${room.organization || ''}">
        </div>
        <div>
          <label for="new-item-comment">Комментарий</label>
          <textarea id="new-item-comment"></textarea>
        </div>
        <div class="form-footer">
          <button class="submit-btn" id="add-item">Добавить предмет</button>
        </div>
      </div>
    </div>
  `;

  // Назначаем обработчики после создания DOM
  document.getElementById('add-item').addEventListener('click', addNewItem);
  
  // Обработчики для кнопок в таблице
  document.querySelectorAll('.edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      editItem(state.selectedRoom.items[index]);
    });
  });
  
  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      deleteItem(index);
    });
  });

  modal.style.display = 'flex';
}

function renderItemsRows(items) {
  if (items.length === 0) {
    return `
      <tr>
        <td colspan="5" style="text-align: center;">Нет предметов</td>
      </tr>
    `;
  }
  
  return items.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.inventoryNumber || '-'}</td>
      <td>${item.organization || '-'}</td>
      <td>${item.comment || '-'}</td>
      <td>
        <button class="action-btn edit-item" data-index="${index}">✏️</button>
        <button class="action-btn delete-item" data-index="${index}">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function setupRoomControls() {
  document.getElementById('add-room').addEventListener('click', showColorPalette);
  document.getElementById('edit-room').addEventListener('click', toggleEditMode);
  
  // Обработчик клика по комнате (делегирование событий)
  document.getElementById('floor-canvas').addEventListener('click', (e) => {
    if (state.editMode) return;
    
    const roomElement = e.target.closest('.room');
    if (!roomElement) return;
    
    const roomId = roomElement.dataset.roomId;
    const room = state.currentFloor?.rooms.find(r => r.id === roomId);
    if (room) {
      openRoomModal(room);
    }
  });
}

/* ========== ПЕРЕТАСКИВАНИЕ И РЕСАЙЗ КОМНАТ ========== */

function startRoomDrag(e) {
  if (e.target.classList.contains('room-resize-handle')) return;
  
  state.draggedRoom = e.currentTarget;
  state.startX = e.clientX - e.currentTarget.getBoundingClientRect().left;
  state.startY = e.clientY - e.currentTarget.getBoundingClientRect().top;

  document.addEventListener('mousemove', handleRoomDrag);
  document.addEventListener('mouseup', stopRoomDrag, { once: true });
}

function handleRoomDrag(e) {
  if (!state.draggedRoom) return;

  const canvas = document.getElementById('floor-canvas').getBoundingClientRect();
  let newX = e.clientX - canvas.left - state.startX;
  let newY = e.clientY - canvas.top - state.startY;

  if (state.snapToGrid) {
    newX = Math.round(newX / state.gridSize) * state.gridSize;
    newY = Math.round(newY / state.gridSize) * state.gridSize;
  }

  newX = Math.max(0, Math.min(newX, canvas.width - state.draggedRoom.offsetWidth));
  newY = Math.max(0, Math.min(newY, canvas.height - state.draggedRoom.offsetHeight));

  state.draggedRoom.style.left = `${newX}px`;
  state.draggedRoom.style.top = `${newY}px`;
}

function stopRoomDrag() {
  if (!state.draggedRoom) return;

  const roomId = state.draggedRoom.dataset.roomId;
  const room = state.currentFloor?.rooms.find(r => r.id === roomId);
  
  if (room) {
    room.x = parseInt(state.draggedRoom.style.left);
    room.y = parseInt(state.draggedRoom.style.top);
    saveState();
  }

  document.removeEventListener('mousemove', handleRoomDrag);
  state.draggedRoom = null;
}

function startRoomResize(e) {
  e.stopPropagation();
  
  state.resizedRoom = e.currentTarget.parentElement;
  state.startWidth = state.resizedRoom.offsetWidth;
  state.startHeight = state.resizedRoom.offsetHeight;
  state.startX = e.clientX;
  state.startY = e.clientY;

  document.addEventListener('mousemove', handleRoomResize);
  document.addEventListener('mouseup', stopRoomResize, { once: true });
}

function handleRoomResize(e) {
  if (!state.resizedRoom) return;

  let newWidth = state.startWidth + (e.clientX - state.startX);
  let newHeight = state.startHeight + (e.clientY - state.startY);

  if (state.snapToGrid) {
    newWidth = Math.max(100, Math.round(newWidth / state.gridSize) * state.gridSize);
    newHeight = Math.max(100, Math.round(newHeight / state.gridSize) * state.gridSize);
  } else {
    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(50, newHeight);
  }

  state.resizedRoom.style.width = `${newWidth}px`;
  state.resizedRoom.style.height = `${newHeight}px`;
}

function stopRoomResize() {
  if (!state.resizedRoom) return;

  const roomId = state.resizedRoom.dataset.roomId;
  const room = state.currentFloor?.rooms.find(r => r.id === roomId);
  
  if (room) {
    room.width = parseInt(state.resizedRoom.style.width);
    room.height = parseInt(state.resizedRoom.style.height);
    saveState();
  }

  document.removeEventListener('mousemove', handleRoomResize);
  state.resizedRoom = null;
}

/* ========== РАБОТА С ПРЕДМЕТАМИ ========== */

function addNewItem() {
  const nameInput = document.getElementById('new-item-name');
  const name = nameInput.value.trim();
  const inventory = document.getElementById('new-item-inventory').value.trim();
  const organization = document.getElementById('new-item-organization').value.trim();
  const comment = document.getElementById('new-item-comment').value.trim();
  
  if (!name) {
    showNotification('Укажите наименование предмета!', 'error');
    nameInput.focus();
    return;
  }
  
  const newItem = {
    id: `item-${Date.now()}`,
    name,
    inventoryNumber: inventory,
    organization: organization || state.selectedRoom.organization,
    comment,
    createdAt: new Date().toISOString()
  };
  
  state.selectedRoom.items.push(newItem);
  renderItemsTable(state.selectedRoom.items);
  
  // Очистка формы
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-inventory').value = '';
  document.getElementById('new-item-comment').value = '';
  document.getElementById('new-item-name').focus();
  
  showNotification('Предмет успешно добавлен');
  saveState();
}

function editItem(item) {
  state.selectedItem = item;
  const modal = document.getElementById('item-modal');
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Редактирование предмета</h3>
      <div class="add-item-form">
        <div>
          <label for="edit-item-name">Наименование*</label>
          <input type="text" id="edit-item-name" value="${item.name}" required>
        </div>
        <div>
          <label for="edit-item-inventory">Инв. номер</label>
          <input type="text" id="edit-item-inventory" value="${item.inventoryNumber || ''}">
        </div>
        <div>
          <label for="edit-item-organization">Организация</label>
          <input type="text" id="edit-item-organization" value="${item.organization || ''}">
        </div>
        <div>
          <label for="edit-item-comment">Комментарий</label>
          <textarea id="edit-item-comment">${item.comment || ''}</textarea>
        </div>
        <div class="form-footer">
          <button id="cancel-edit">Отмена</button>
          <button class="submit-btn" id="save-item">Сохранить</button>
        </div>
      </div>
    </div>
  `;
  
  modal.querySelector('#save-item').addEventListener('click', saveItemChanges);
  modal.querySelector('#cancel-edit').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.style.display = 'flex';
}

function saveItemChanges() {
  const name = document.getElementById('edit-item-name').value.trim();
  const inventory = document.getElementById('edit-item-inventory').value.trim();
  const organization = document.getElementById('edit-item-organization').value.trim();
  const comment = document.getElementById('edit-item-comment').value.trim();
  
  if (!name) {
    showNotification('Укажите наименование предмета!', 'error');
    return;
  }
  
  state.selectedItem.name = name;
  state.selectedItem.inventoryNumber = inventory;
  state.selectedItem.organization = organization;
  state.selectedItem.comment = comment;
  
  renderItemsTable(state.selectedRoom.items);
  document.getElementById('item-modal').style.display = 'none';
  showNotification('Изменения сохранены');
  saveState();
}

function deleteItem(index) {
  if (confirm('Вы уверены, что хотите удалить этот предмет?')) {
    state.selectedRoom.items.splice(index, 1);
    renderItemsTable(state.selectedRoom.items);
    showNotification('Предмет удален');
    saveState();
  }
}

/* ========== ИМПОРТ/ЭКСПОРТ ========== */

function exportToJSON() {
  const data = {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    building: state.building
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAsFile(blob, `inventory_${new Date().toISOString().split('T')[0]}.json`);
  showNotification('Данные экспортированы в JSON');
}

function exportToCSV() {
  let csv = 'Этаж;Комната;Наименование;Инв. номер;Организация;Комментарий\n';
  
  state.building.floors.forEach(floor => {
    floor.rooms.forEach(room => {
      room.items.forEach(item => {
        csv += `"${escapeCSV(floor.name)}";"${escapeCSV(room.name)}";"${escapeCSV(item.name)}";"${escapeCSV(item.inventoryNumber)}";"${escapeCSV(item.organization)}";"${escapeCSV(item.comment)}"\n`;
      });
    });
  });
  
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  saveAsFile(blob, `inventory_${new Date().toISOString().split('T')[0]}.csv`);
  showNotification('Данные экспортированы в CSV');
}

function importFromJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.building || !Array.isArray(data.building.floors)) {
        throw new Error('Некорректный формат файла');
      }
      
      state.building = data.building;
      state.currentFloor = null;
      state.selectedRoom = null;
      event.target.value = '';
      
      renderFloorsList();
      renderFloorCanvas();
      
      if (state.building.floors.length > 0) {
        selectFloor(state.building.floors[0].id);
      }
      
      showNotification('Данные успешно импортированы');
      saveState();
    } catch (error) {
      console.error('Ошибка импорта:', error);
      showNotification(`Ошибка импорта: ${error.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function saveAsFile(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(str) {
  if (!str) return '';
  return str.replace(/"/g, '""').replace(/\n/g, ' ');
}

/* ========== ИНИЦИАЛИЗАЦИЯ ========== */

function setupImportExport() {
  document.getElementById('export-json').addEventListener('click', exportToJSON);
  document.getElementById('export-csv').addEventListener('click', exportToCSV);
  document.getElementById('import-json').addEventListener('change', importFromJSON);
}

function initModalCloseHandlers() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupFloorControls();
  setupRoomControls();
  setupImportExport();
  initModalCloseHandlers();
  
  if (state.currentFloor) {
    renderFloorCanvas();
  }
  
  console.log('Приложение инициализировано');
});