class FloorPlan {
    constructor(config) {
        this.config = config;
        this.roomItems = {};
        this.scale = 1;
        this.isFullView = false;
        this.currentRoom = null;

        // Добавляем элементы для поиска
        this.searchInput = document.getElementById('search-input');
        this.searchButton = document.getElementById('search-button');
        this.clearSearchButton = document.getElementById('clear-search');

        this.initElements();
        this.initEventListeners();
        this.loadFromStorage();
        this.createFloorPlan();
        this.updateRoomStyles();
    }

    initElements() {
        this.modal = new bootstrap.Modal('#modal');
        this.container = document.getElementById('container');
        this.floorPlan = document.getElementById('floor-plan');
        this.modalTitle = document.getElementById('modal-title');
        this.modalItemsBody = document.getElementById('modal-items-body');
        this.itemNameInput = document.getElementById('item-name');
        this.itemInvInput = document.getElementById('item-inv');
        this.itemInvComment = document.getElementById('item-comment');
        this.addItemBtn = document.getElementById('add-item');
        this.exportBtn = document.getElementById('export-data');
        this.fileInput = document.getElementById('csv-file');
        this.loadDataBtn = document.getElementById('load-data');
    }

    initEventListeners() {
        this.addItemBtn.addEventListener('click', () => this.addItem());
        this.exportBtn.addEventListener('click', () => this.exportToCSV());
        this.loadDataBtn.addEventListener('click', () => this.loadCSVData());
        window.addEventListener('resize', () => this.checkFullView());

        // Добавляем обработчики для поиска
        this.searchButton.addEventListener('click', () => this.searchItems());
        this.clearSearchButton.addEventListener('click', () => this.clearSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchItems();
        });
    }

    // Функция поиска предметов
    searchItems() {
        const searchTerm = this.searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            return;
        }

        this.clearSearch(false);
        const foundInRooms = new Set();

        // Ищем во всех комнатах
        for (const [roomId, items] of Object.entries(this.roomItems)) {
            const hasMatch = items.some(item => 
                item.name.toLowerCase().includes(searchTerm) || 
                item.inventory.toLowerCase().includes(searchTerm) ||
                item.comment.toLowerCase().includes(searchTerm)
            );

            if (hasMatch) foundInRooms.add(roomId);
        }

        // Подсвечиваем результаты
        if (foundInRooms.size > 0) {
            foundInRooms.forEach(roomId => {
                const roomElement = document.getElementById(roomId);
                if (roomElement) {
                    roomElement.classList.add('highlighted');
                }
            });

            // Прокрутка к первому результату
            const firstResult = document.querySelector('.room.highlighted');
            if (firstResult) {
                firstResult.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'center'
                });
            }
            
            //alert(`Найдено совпадений в ${foundInRooms.size} комнатах`);
        } else {
            //alert('Совпадений не найдено');
        }
    }

    // Сброс поиска
    clearSearch(clearInput = true) {
        if (clearInput) this.searchInput.value = '';
        
        document.querySelectorAll('.room.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
    }

    createFloorPlan() {
        this.config.rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = `room ${room.firm}`;
            roomElement.id = room.id;
            roomElement.textContent = room.name;
            roomElement.style.left = `${room.x}px`;
            roomElement.style.top = `${room.y}px`;
            roomElement.style.width = `${room.width}px`;
            roomElement.style.height = `${room.height}px`;
            
            // Добавляем класс и стили для L-образной комнаты
            if (room.shape === 'l-shaped') {
                roomElement.classList.add('l-shaped');
                roomElement.style.clipPath = this.generateLShapeClipPath(room);
            }
            
            roomElement.addEventListener('click', () => this.showRoomItems(room.id, room.name));
            this.floorPlan.appendChild(roomElement);
        });
    }

    // Генерация clip-path для L-образной комнаты
    generateLShapeClipPath(room) {
        const { width, height, shapeParams } = room;
        const { direction = 'bottom-right', cutWidth = width * 0.3, cutHeight = height * 0.3 } = shapeParams || {};
        
        const rightCutStart = width - cutWidth;
        const bottomCutStart = height - cutHeight;
        
        switch(direction) {
            case 'top-left':
                return `polygon(
                    ${cutWidth}px 0%,
                    100% 0%,
                    100% 100%,
                    0% 100%,
                    0% ${cutHeight}px,
                    ${cutWidth}px ${cutHeight}px
                )`;
                
            case 'top-right':
                return `polygon(
                    0% 0%,
                    ${rightCutStart}px 0%,
                    ${rightCutStart}px ${cutHeight}px,
                    100% ${cutHeight}px,
                    100% 100%,
                    0% 100%
                )`;
                
            case 'bottom-left':
                return `polygon(
                    0% 0%,
                    100% 0%,
                    100% ${bottomCutStart}px,
                    ${cutWidth}px ${bottomCutStart}px,
                    ${cutWidth}px 100%,
                    0% 100%
                )`;
                
            case 'bottom-right':
            default:
                return `polygon(
                    0% 0%,
                    100% 0%,
                    100% ${bottomCutStart}px,
                    ${rightCutStart}px ${bottomCutStart}px,
                    ${rightCutStart}px 100%,
                    0% 100%
                )`;
        }
    }

    refreshRoomPositions() {
        this.config.rooms.forEach(room => {
            const el = document.getElementById(room.id);
            if (el) {
                el.style.left = `${room.x}px`;
                el.style.top = `${room.y}px`;
                el.style.width = `${room.width}px`;
                el.style.height = `${room.height}px`;
            }
        });
    }

    showRoomItems(roomId, roomName) {
        this.currentRoom = roomId;
        this.modalTitle.textContent = `Предметы в ${roomName}`;
        this.modalItemsBody.innerHTML = '';
        
        const items = this.roomItems[roomId] || [];
        
        if (items.length === 0) {
            this.modalItemsBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-3 text-muted">
                        В этой комнате пока нет предметов
                    </td>
                </tr>
            `;
        } else {
            items.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${item.inventory}</td>
                    <td>${item.comment}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-action edit-item" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action delete-item" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                this.modalItemsBody.appendChild(row);
            });

            // Добавляем обработчики для кнопок редактирования/удаления
            document.querySelectorAll('.edit-item').forEach(btn => {
                btn.addEventListener('click', (e) => this.editItem(e.target.closest('button').dataset.index));
            });
            
            document.querySelectorAll('.delete-item').forEach(btn => {
                btn.addEventListener('click', (e) => this.deleteItem(e.target.closest('button').dataset.index));
            });
        }
        
        this.modal.show();
    }

    addItem() {
        const name = this.itemNameInput.value.trim();
        const inv = this.itemInvInput.value.trim();
        const comm = this.itemCommentInput.value.trim();
        
        if (!name || !inv) {
            alert('Заполните наименование');
            return;
        }
        
        if (!this.roomItems[this.currentRoom]) {
            this.roomItems[this.currentRoom] = [];
        }
        
        this.roomItems[this.currentRoom].push({ name, inventory: inv, comment: comm });
        this.saveToStorage();
        this.showRoomItems(this.currentRoom, document.getElementById(this.currentRoom).textContent);
        
        // Очищаем поля ввода
        this.itemNameInput.value = '';
        this.itemInvInput.value = '';
        this.itemCommentInput.value = '';

        this.updateRoomStyles()
    }

    editItem(index) {
        const items = this.roomItems[this.currentRoom];
        if (!items || index >= items.length) return;
        
        const newName = prompt('Новое название:', items[index].name);
        if (newName === null) return;
        
        const newInv = prompt('Новый инв. номер:', items[index].inventory);
        if (newInv === null) return;

        const newComm = prompt('Новый комментарий:', items[index].comment);
        if (newInv === null) return;
        
        items[index] = { 
            name: newName.trim(), 
            inventory: newInv.trim(),
            comment: newComm.trim()
        };
        
        this.saveToStorage();
        this.showRoomItems(this.currentRoom, document.getElementById(this.currentRoom).textContent);

        this.updateRoomStyles()
    }

    deleteItem(index) {
        if (!confirm('Удалить этот предмет?')) return;
        
        // Сохраняем текущие стили комнаты перед изменением
        const roomElement = document.getElementById(this.currentRoom);
        const { left, top, width, height } = roomElement.style;
        
        this.roomItems[this.currentRoom].splice(index, 1);
        this.saveToStorage();
        
        // Восстанавливаем позицию и размер после обновления
        this.showRoomItems(this.currentRoom, roomElement.textContent);
        roomElement.style.left = left;
        roomElement.style.top = top;
        roomElement.style.width = width;
        roomElement.style.height = height;
        
        this.updateRoomStyles();
    }

    loadCSVData() {
        if (!this.fileInput.files.length) {
            //alert('Выберите файл');
            return;
        }
        
        const file = this.fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                this.processCSVData(e.target.result);
                //alert('Данные загружены!');
            } catch (error) {
                alert(`Ошибка: ${error.message}`);
            }
        };
        
        reader.readAsText(file);
    }

    processCSVData(csvData) {
        this.roomItems = {};
        const lines = csvData.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) throw new Error('CSV файл пуст');
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIndex = headers.findIndex(h => h.includes('наименование'));
        const invIndex = headers.findIndex(h => h.includes('инвентарный'));
        const roomIndex = headers.findIndex(h => h.includes('комната'));
        const commIndex = headers.findIndex(h => h.includes('комментарий'));
        
        if (nameIndex === -1 || invIndex === -1 || roomIndex === -1) {
            throw new Error('Неверный формат CSV');
        }
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 3) continue;
            
            const itemName = values[nameIndex].trim();
            const itemInv = values[invIndex].trim();
            const itemComm = values[commIndex].trim();
            const roomName = values[roomIndex].trim().toLowerCase();
            const roomId = this.findRoomId(roomName);
            
            if (roomId) {
                if (!this.roomItems[roomId]) this.roomItems[roomId] = [];
                this.roomItems[roomId].push({ name: itemName, inventory: itemInv, comment: itemComm});
            }
        }

        this.updateRoomStyles()
        this.saveToStorage();
        this.updateRoomStyles();
    }

    exportToCSV() {
        let csv = 'Наименование,Инвентарный номер,Комната,Комментарий\n';
        
        for (const [roomId, items] of Object.entries(this.roomItems)) {
            const roomName = this.config.rooms.find(r => r.id === roomId)?.name || roomId;
            
            items.forEach(item => {
                csv += `"${item.name}","${item.inventory}","${roomName}","${item.comment}"\n`;
                //csv += `"${item.name}","${item.inventory}","${roomName}"\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_${this.config.storageKey}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    findRoomId(roomName) {
        for (const [key, value] of Object.entries(this.config.roomMapping)) {
            if (roomName.includes(key.toLowerCase())) {
                return value;
            }
        }
        return null;
    }

    updateRoomStyles() {
        // Теперь метод только обновляет подсветку при поиске
        if (this.lastSearchHighlight) {
            this.lastSearchHighlight.forEach(roomId => {
                const el = document.getElementById(roomId);
                if (el) el.classList.add('highlighted');
            });
        }
    }

    saveToStorage() {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.roomItems));
        this.updateRoomStyles();
    }

    loadFromStorage() {
        const data = localStorage.getItem(this.config.storageKey);
        if (data) {
            try {
                this.roomItems = JSON.parse(data);
                this.updateRoomStyles();
            } catch (e) {
                console.error('Ошибка загрузки данных:', e);
            }
        }
    }

    checkFullView() {
        // Оставлено для совместимости, но не используется без миникарты
    }
}

// Конфигурация первого этажа
const floor1Config = {
    rooms: [
        { id: 'room101', name: 'Лестница 1', firm: 'firstCompany', x: 20,  y: 100, width: 80,  height: 180 },
        { id: 'room102', name: '100', firm: 'firstCompany',        x: 100, y: 100, width: 120, height: 160 },
        { id: 'room103', name: '101', firm: 'firstCompany',        x: 220, y: 100, width: 100, height: 160 },
        { id: 'room104', name: '102', firm: 'firstCompany',        x: 320, y: 100, width: 100, height: 160 },
        { id: 'room105', name: '103', firm: 'secondCompany',        x: 420, y: 100, width: 100, height: 160 },
        { id: 'room106', name: '104', firm: 'secondCompany',        x: 520, y: 100, width: 100, height: 160 },
        { id: 'room107', name: '105', firm: 'thirdCompany',        x: 620, y: 100, width: 160, height: 160,
            /*shape: 'l-shaped',
            shapeParams:{
                direction: 'top-left',
                cutWidth: 75,
                cutHeight: 55
                }*/
        },
        { id: 'room108', name: 'Коридор 1', firm: 'firstCompany', x: 100, y: 260, width: 680, height: 60 },


        ],
    roomMapping: {
        'Лестница 1': 'room101',
        '100': 'room102',
        '101': 'room103',
        '102': 'room104',
        '103': 'room105',
        '104': 'room106',
        '105': 'room107',
        'Коридор 1': 'room8',
    },
    storageKey: 'inventory_floor1'
};

// Конфигурация второго этажа
const floor2Config = {
    rooms: [
        { id: 'room201', name: '201', firm: 'firstCompany', x: 100, y: 100, width: 200, height: 150 },
        { id: 'room202', name: '202', firm: 'firstCompany', x: 350, y: 100, width: 200, height: 150 },
        { id: 'room203', name: 'Переговорная', firm: 'firstCompany', x: 100, y: 300, width: 250, height: 180 },
        { id: 'room204', name: 'Лаборатория', firm: 'secondCompany', x: 650, y: 100, width: 300, height: 200 },
        { id: 'room205', name: 'Склад', firm: 'secondCompany', x: 650, y: 350, width: 300, height: 250 }
    ],
    roomMapping: {
        '201': 'room201',
        '202': 'room202',
        'переговорная': 'room203',
        'лаборатория': 'room204',
        'склад': 'room205'
    },
    storageKey: 'inventory_floor2'
};

// Инициализация соответствующего этажа
document.addEventListener('DOMContentLoaded', () => {
    const isFloor2 = window.location.pathname.includes('floor2.html');
    new FloorPlan(isFloor2 ? floor2Config : floor1Config);
});