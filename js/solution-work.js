'use strict';

const urlApi = 'https://neto-api.herokuapp.com';

const wrapCommentsCanvas = document.createElement('div');
const canvas = document.createElement('canvas');

let connection;
let dataGetParse; 
let showComments = {};
let currColor;

const currentImage = document.querySelector('.current-image');
const loader = document.querySelector('.image-loader');
const wrapApp = document.querySelector('.app');

let movedPiece = null;
let minY, minX, maxX, maxY;
let shiftX = 0;
let shiftY = 0;

let url = new URL(`${window.location.href}`);
let paramId = url.searchParams.get('id'); //ищем параметр 'id'

document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

setGlobalVar('error');
setGlobalVar('menu');
setGlobalVar('burger');

// ----------режим "Публикация"------------------------------------------------
currentImage.src = ''; // убираем фон

getGlobalVar('menu').dataset.state = 'initial'; // скрываем пункты меню для режима "Публикации"
wrapApp.dataset.state = '';
hideElement(getGlobalVar('burger')); // скрываем пункт меню Burger
wrapApp.removeChild(document.querySelector('.comments__form')); // убираем комментарии в режиме "Публикации"

getGlobalVar('menu').querySelector('.new').addEventListener('click', uploadFileFromInput); //открываем окно выбора файла для загрузки
wrapApp.addEventListener('drop', onFilesDrop); //загрузка файла drag&drop
wrapApp.addEventListener('dragover', event => event.preventDefault()); 

// ----------режим "Рецензирование"-----------------------------------------------
getGlobalVar('burger').addEventListener('click', showMenu); //при клике на berger. показываем все меню

canvas.addEventListener('click', checkComment); //при клике на хосле создаем форму комментариев 

document.querySelector('.menu__toggle-title_on').addEventListener('click', markerCheckboxOn);// переключатели "Показывать комментарии"
document.querySelector('#comments-on').addEventListener('click', markerCheckboxOn); // переключатели "Показывать комментарии"
document.querySelector('.menu__toggle-title_off').addEventListener('click', markerCheckboxOff);// переключатели "Скрыть комментарии"
document.querySelector('#comments-off').addEventListener('click', markerCheckboxOff);// переключатели "Скрыть комментарии"

getGlobalVar('menu').querySelector('.menu_copy').addEventListener('click', copyUrl); // копируем ссылку по клику на кнопку "Копировать" в режиме "Поделиться"
urlId(paramId); // Получаем из ссылки параметр id

Array.from(getGlobalVar('menu').querySelectorAll('.menu__color')).forEach(color => {// для каждого каждого элемента с классом '.menu__color'
	if (color.checked) {  //если элемент выбран  (checked)
		currColor = getComputedStyle(color.nextElementSibling).backgroundColor; //получим цвет 
	}
	color.addEventListener('click', (event) => { //при клике на элемент
		currColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor; //получим цвет 
	});
});

const ctx = canvas.getContext('2d'); //контекст
const BRUSH_RADIUS = 4; //размер кисти
let curves = [];
let drawing = false;
let needsRepaint = false;

canvas.addEventListener("mousedown", (event) => {
	if (!(getGlobalVar('menu').querySelector('.draw').dataset.state === 'selected')) return;
	drawing = true;

	const curve = []; 
	curve.color = currColor;

	curve.push(makePoint(event.offsetX, event.offsetY)); 
	curves.push(curve); 
	needsRepaint = true;
});

canvas.addEventListener("mouseup", (event) => {
	getGlobalVar('menu').style.zIndex = '1';
	drawing = false;
});

canvas.addEventListener("mouseleave", (event) => {
	drawing = false;
});

canvas.addEventListener("mousemove", (event) => {
	if (drawing) {
		getGlobalVar('menu').style.zIndex = '0';
		curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
		needsRepaint = true;
		trottledSendMask();
	//	debounceSendMask();

	}
});

const trottledSendMask = throttle(sendMaskState, 1000);
//const debounceSendMask = debounce(sendMaskState, 1000);

tick();

// закомментировано из-за того что сервера работают не стабильно, происходит обрыв соединения и сессия закрывается 
//window.addEventListener('beforeunload', () => { connection.close() }); //закрываем соединение при уходе со страницы

// Инициализация хранилища
function getGlobalStorage() {
	if( typeof( window['globalStorage'] ) === 'undefined' ) {
		window.globalStorage = {};
	}

	return window.globalStorage;
}

// Устанавливаем переменную в хранилище
function setGlobalVar(arg) {
	let storage = getGlobalStorage();

	storage[arg] = document.querySelector(`.${arg}`);
}

// Достаем переменную из хранилища и выводим в консоль ее значение
function getGlobalVar(arg) {
	let storage = getGlobalStorage();

	return storage[arg];
}

//Копируем ссылку из пункта меню "Поделиться"
function copyUrl() {  
	getGlobalVar('menu').querySelector('.menu__url').select(); // выбрали текст
	try {
		let successful = document.execCommand('copy'); //выполним команду копирования	
		let msg = successful ? 'успешно ' : 'не';  
		console.log(`URL ${msg} скопирован`);  
	} catch(err) {  
		console.log('Ошибка копирования');  
	}  
	window.getSelection().removeAllRanges();
}

// Убираем расширение файла
function delExtension(inputText) { 
	let regExp = new RegExp(/\.[^.]+$/gi);
	return inputText.replace(regExp, '');  
}

// разбивка timestamp на читаемое отображение даты и времени
function getDate(timestamp) {
	const options = {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	};
	const date = new Date(timestamp);
	const dateStr = date.toLocaleString('ru-RU', options);

	return dateStr.slice(0, 8) + dateStr.slice(9);
}

// Скрываем текст ошибки через 7сек.
function errorRemove() {
	setTimeout(function() {
		hideElement(getGlobalVar('error'))
	}, 7000);
}

// Скрываем элементы
function hideElement(el) {
	el.style.display = 'none';
}
// Показываем элементы
function showElement(el) {
	el.style.display = '';
}

// Перемещение (drag) меню
function dragStart(event) {
	if (!event.target.classList.contains('drag')) { return; }

	movedPiece = event.target.parentElement;
	minX = wrapApp.offsetLeft;
	minY = wrapApp.offsetTop;
		
	maxX = wrapApp.offsetLeft + wrapApp.offsetWidth - movedPiece.offsetWidth;
	maxY = wrapApp.offsetTop + wrapApp.offsetHeight - movedPiece.offsetHeight;
		
	shiftX = event.pageX - event.target.getBoundingClientRect().left - window.pageXOffset;
	shiftY = event.pageY - event.target.getBoundingClientRect().top - window.pageYOffset;
}

function drag(event) {
	if (!movedPiece) {return; }

	let x = event.pageX - shiftX;
	let y = event.pageY - shiftY;
	x = Math.min(x, maxX);
	y = Math.min(y, maxY);
	x = Math.max(x, minX);
	y = Math.max(y, minY);
	movedPiece.style.left = x + 'px';
	movedPiece.style.top = y + 'px';
}

function drop(evet) {
	if (movedPiece) {
		movedPiece = null;
	}
}

function throttle(func, delay = 0) {
	let isWaiting = false;
	return function () {
		if (!isWaiting) {
	func.apply(this, arguments);	
			isWaiting = true;		
			setTimeout(() => {
				func.apply(this, arguments);		
				isWaiting = false;
			}, delay);
		}
	}
}

/*function debounce(func, delay = 0) {
    let timeout;
    return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            func();
        }, delay);
    };
}
*/

// ----------"Публикация"------------------------------------------------
// Загрузка изображения
function uploadFileFromInput(event) {
	hideElement(getGlobalVar('error'));
	//добавим форму для вызова окна "выбора файла"
	const input = document.createElement('input');
	input.setAttribute('id', 'fileInput');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', 'image/jpeg, image/png');
	hideElement(input);
	getGlobalVar('menu').appendChild(input);

	document.querySelector('#fileInput').addEventListener('change', event => {
		const files = Array.from(event.currentTarget.files);

		if (currentImage.dataset.load === 'load') {
			removeForm();
		}

		sendFile(files);
	});

	input.click();
	getGlobalVar('menu').removeChild(input);
}

// drag & drop изображения для загрузки
function onFilesDrop(event) {
	event.preventDefault();
	hideElement(getGlobalVar('error'));
	const files = Array.from(event.dataTransfer.files);
	
	//выдаем ошибку, при повторном drop изображении
	if (currentImage.dataset.load === 'load') {
		showElement(getGlobalVar('error'));
		getGlobalVar('error').lastElementChild.textContent = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
		errorRemove();
		return;
	}

	//проверяем "кинутый" файл, если файл нужного типа, то загружаем, иначе показываем ошибку.
	files.forEach(file => {
		if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
			sendFile(files);
		} else {
			showElement(getGlobalVar('error'))
		}
	});
}

// загрузка изображения на сервер
function sendFile(files) {
	const formData = new FormData();
	
	files.forEach(file => {
		const fileTitle = delExtension(file.name);
		formData.append('title', fileTitle);
		formData.append('image', file);
	});

	showElement(loader);

	fetch(`${urlApi}/pic`, {
			body: formData,
			credentials: 'same-origin',
			method: 'POST'
		})
		.then( res => {
			if (res.status >= 200 && res.status < 300) {
				return res;
			}
			throw new Error (res.statusText);
		})
		.then(res => res.json())
		.then(res => {
			setReview(res.id);
		})
		.catch(er => {
			console.log(er);
			hideElement(loader);
		});
}

// удаление форм комментариев, при загрузке нового изображения
function removeForm() {
	const formComment = wrapApp.querySelectorAll('.comments__form');
	Array.from(formComment).forEach(item => {item.remove()})
}

// ----------//"Публикация"--------------------------------

// получаем информацию о файле
function setReview(id) {
	const xhrGetInfo = new XMLHttpRequest();
	xhrGetInfo.open(
		'GET',
		`${urlApi}/pic/${id}`,
		false
	);
	xhrGetInfo.send();

	dataGetParse = JSON.parse(xhrGetInfo.responseText);
	localStorage.host = `${window.location.origin}${window.location.pathname}?id=${dataGetParse.id}`;

	wss();	
	setcurrentImage(dataGetParse);
	getGlobalVar('burger').style.cssText = ``;
	showMenu();

	currentImage.addEventListener('load', () => {
		hideElement(loader);
		createWrapforCanvasComment();
		createCanvas();
		currentImage.dataset.load = 'load';
	});

	updateCommentForm(dataGetParse.comments);
}

// ----------"Рецензирование"-----------------------------------------------
// раскрытие пунктов меню
function showMenu() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		modeItem.dataset.state = '';
		modeItem.addEventListener('click', () => {
			
			if (!modeItem.classList.contains('new')){
				getGlobalVar('menu').dataset.state = 'selected';
				modeItem.dataset.state = 'selected';
			}
			
			if (modeItem.classList.contains('share')) {
				getGlobalVar('menu').querySelector('.menu__url').value = localStorage.host;
			}
		})
	})
}

// показываем меню "Комментарии"
function showMenuComments() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		if (!modeItem.classList.contains('comments')) { return; }
			
		getGlobalVar('menu').dataset.state = 'selected';
		modeItem.dataset.state = 'selected';
	})
}

// добавляем фон 
function setcurrentImage(fileInfo) {
	currentImage.src = fileInfo.url;
}

// ------------Комментарии
//чекбок скрыть комментарии
function markerCheckboxOff() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = 'none';
	 })
}

//чекбок показать комментарии
function markerCheckboxOn() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = '';
	})
}

//создаем формы на обертке для комментариев
function checkComment(event) {
	if (!(getGlobalVar('menu').querySelector('.comments').dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) { return; }
	wrapCommentsCanvas.appendChild(createCommentForm(event.offsetX, event.offsetY));
}

//Создаем холст для рисования	
function createCanvas() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width.slice(0, -2);
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height.slice(0, -2);
	canvas.width = width;
	canvas.height = height;

	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.display = 'block';
	canvas.style.zIndex = '1';

	wrapCommentsCanvas.appendChild(canvas);

	curves = [];
    drawing = false;
    needsRepaint = false;
}

// создаем обертку для комментариев
function createWrapforCanvasComment() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width;
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height;
	wrapCommentsCanvas.style.cssText = `
		width: ${width};
		height: ${height};
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: block;
	`;
	wrapApp.appendChild(wrapCommentsCanvas);

	// отображаем комментарии (по клику) поверх остальных
	wrapCommentsCanvas.addEventListener('click', event => {
		if (event.target.closest('form.comments__form')) {
			Array.from(wrapCommentsCanvas.querySelectorAll('form.comments__form')).forEach(form => {
				form.style.zIndex = 2;
			});
			event.target.closest('form.comments__form').style.zIndex = 3;
		}
	});
}

//Форма для комментариев
function createCommentForm(x, y) {
	const formComment = document.createElement('form');
	formComment.classList.add('comments__form');
	formComment.innerHTML = `
		<span class="comments__marker"></span><input type="checkbox" class="comments__marker-checkbox">
		<div class="comments__body">
			<div class="comment">
				<div class="loader">
					<span></span>
					<span></span>
					<span></span>
					<span></span>
					<span></span>
				</div>
			</div>
			<textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
			<input class="comments__close" type="button" value="Закрыть">
			<input class="comments__submit" type="submit" value="Отправить">
		</div>`;

	//смещение, чтобы маркер встал туда, куда кликнули
	const left = x - 22;
	const top = y - 14;

	formComment.style.cssText = `
		top: ${top}px;
		left: ${left}px;
		z-index: 2;
	`;
	formComment.dataset.left = left;
	formComment.dataset.top = top;

	hideElement(formComment.querySelector('.loader').parentElement);

	//кнопка закрыть
	formComment.querySelector('.comments__close').addEventListener('click', () => {
		formComment.querySelector('.comments__marker-checkbox').checked = false;
	});

	// кнопка отправить
	formComment.addEventListener('submit', messageSend);
	formComment.querySelector('.comments__input').addEventListener('keydown', keySendMessage);

	// Отправляем комментарий по нажатию Ctrl + Enter
	function keySendMessage(event) {
		if (event.repeat) { return; }
		if (!event.ctrlKey) { return; }

		switch (event.code) {
			case 'Enter':
				messageSend();
			break;
		}
	}

	// Отправляем комментария по клику на кнопку "Отправить"
	function messageSend(event) {
		if (event) {
			event.preventDefault();
		}
		const message = formComment.querySelector('.comments__input').value;
		const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
		commentsSend(messageSend);
		showElement(loaderComment.parentElement);
		formComment.querySelector('.comments__input').value = '';
	}

	// Отправка комментария на сервер
	function commentsSend(message) {
		fetch(`${urlApi}/pic/${dataGetParse.id}/comments`, {
				method: 'POST',
				body: message,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
			})
			.then( res => {
				if (res.status >= 200 && res.status < 300) {
					return res;
				}
				throw new Error (res.statusText);
			})
			.then(res => res.json())
			.catch(er => {
				console.log(er);
				formComment.querySelector('.loader').parentElement.style.display = 'none';
			});
	}

	return formComment;
}

//Добавление комментария в форму
function addMessageComment(message, form) {
	let parentLoaderDiv = form.querySelector('.loader').parentElement;

	const newMessageDiv = document.createElement('div');
	newMessageDiv.classList.add('comment');
	newMessageDiv.dataset.timestamp = message.timestamp;
		
	const commentTimeP = document.createElement('p');
	commentTimeP.classList.add('comment__time');
	commentTimeP.textContent = getDate(message.timestamp);
	newMessageDiv.appendChild(commentTimeP);

	const commentMessageP = document.createElement('p');
	commentMessageP.classList.add('comment__message');
	commentMessageP.textContent = message.message;
	newMessageDiv.appendChild(commentMessageP);

	form.querySelector('.comments__body').insertBefore(newMessageDiv, parentLoaderDiv);
}

//обновление форм с комментариями
function updateCommentForm(newComment) {
	if (!newComment) return;
	Object.keys(newComment).forEach(id => {
		if (id in showComments) return;
			
		showComments[id] = newComment[id];
		let needCreateNewForm = true;

		Array.from(wrapApp.querySelectorAll('.comments__form')).forEach(form => {
			//добавляем сообщение в форму с заданными координатами left и top
			if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
				form.querySelector('.loader').parentElement.style.display = 'none';
				addMessageComment(newComment[id], form); 
				needCreateNewForm = false;
			}
		});

		//создаем форму и добавляем в нее сообщение
		if (needCreateNewForm) {
			const newForm = createCommentForm(newComment[id].left + 22, newComment[id].top + 14);
			newForm.dataset.left = newComment[id].left;
			newForm.dataset.top = newComment[id].top;
			newForm.style.left = newComment[id].left + 'px';
			newForm.style.top = newComment[id].top + 'px';
			wrapCommentsCanvas.appendChild(newForm);
			addMessageComment(newComment[id], newForm);

			if (!wrapApp.querySelector('#comments-on').checked) {
				newForm.style.display = 'none';
			}
		}
	});
}

//вставка полученных с сервера комментариев
function insertWssCommentForm(wssComment) {
	const wsCommentEdited = {};
	wsCommentEdited[wssComment.id] = {};
	wsCommentEdited[wssComment.id].left = wssComment.left;
	wsCommentEdited[wssComment.id].message = wssComment.message;
	wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
	wsCommentEdited[wssComment.id].top = wssComment.top;
	updateCommentForm(wsCommentEdited);
}

// веб сокет
function wss() {
	connection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${dataGetParse.id}`);
	connection.addEventListener('message', event => {
		if (JSON.parse(event.data).event === 'pic'){
			if (JSON.parse(event.data).pic.mask) {
				canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
			} else {
				canvas.style.background = ``;
			}
		}

		if (JSON.parse(event.data).event === 'comment'){
			insertWssCommentForm(JSON.parse(event.data).comment);
		}

		if (JSON.parse(event.data).event === 'mask'){
			canvas.style.background = `url(${JSON.parse(event.data).url})`;
		}
	});
}
// проверяем ссылку на параметр id
function urlId(id) {
	if (!id) { return;	}
	setReview(id);
	showMenuComments();
}

function circle(point) {
	ctx.beginPath();
	ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
	ctx.fill();
}

function smoothCurveBetween (p1, p2) {
	const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
	ctx.quadraticCurveTo(...p1, ...cp);
}

function smoothCurve(points) {
	ctx.beginPath();
	ctx.lineWidth = BRUSH_RADIUS;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	ctx.moveTo(...points[0]);

	for(let i = 1; i < points.length - 1; i++) {
		smoothCurveBetween(points[i], points[i + 1]);
	}

	ctx.stroke();
}
// координаты положения курсора
function makePoint(x, y) {
	return [x, y];
}

// перерисовка canvas
function repaint () {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	curves.forEach((curve) => {
		ctx.strokeStyle = curve.color;
		ctx.fillStyle = curve.color;

		circle(curve[0]);
		smoothCurve(curve);
	});
}
// отправка канвас на сервер
function sendMaskState() {
	canvas.toBlob(function (blob) {
		connection.send(blob);
		console.log(connection)
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	});
}

// Производим анимацию 
function tick () {
	// Двигаем меню если оно находится с края окна и не помещается при развертывании
	if (getGlobalVar('menu').offsetHeight > 66) {
		getGlobalVar('menu').style.left = (wrapApp.offsetWidth - getGlobalVar('menu').offsetWidth) - 10 + 'px';
	}

	// рисуем canvas
	if(needsRepaint) {
		repaint();
		needsRepaint = false;
	}

	window.requestAnimationFrame(tick);
}