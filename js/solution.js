'use strict';

const urlApi = 'https://neto-api.herokuapp.com';
const urlWss = 'wss://neto-api.herokuapp.com/pic';
const errorFileType = 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.';
const errorMoreDrag = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';

const wrapCommentsCanvas = document.createElement('div');
const canvas = document.createElement('canvas');

let host;
let dataParse;
let dataGetParse; 
let showComments = {};
let count = 0;

const error = document.querySelector('.error');
const menu = document.querySelector('.menu');
const menuBurger = menu.querySelector('.burger');
const menuСomments = menu.querySelector('.comments');
const menuDraw = menu.querySelector('.draw');
const menuNewPic = menu.querySelector('.new');
const menuUrl = menu.querySelector('.menu__url');

const currentImage = document.querySelector('.current-image');
const loader = document.querySelector('.image-loader');
const wrapApp = document.querySelector('.app');
const formsComments = document.querySelector('.comments__form');

const commentsMarkerCheckboxOn = document.querySelector('.menu__toggle-title_on');
const commentsMarkerCheckboxOff = document.querySelector('.menu__toggle-title_off');
const toggleOn = document.querySelector('#comments-on');
const toggleOff = document.querySelector('#comments-off');

// убираем расширение файла
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

// скрыть текст ошибки через 7сек.
function errorRemove() {
	setTimeout(function() {
		hide(error)
	}, 7000);
}

//
function hide(el) {
	el.setAttribute('style', 'display: none;');
}


// Перемещение (drag) меню
document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

let movedPiece = null;
let minY, minX, maxX, maxY;
let shiftX = 0;
let shiftY = 0;

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

function throttle(callback) {
	let isWaiting = false;
	return function (...rest) {
		if (!isWaiting) {
			callback.apply(this, rest);
			isWaiting = true;
			requestAnimationFrame(() => {
				isWaiting = false;
			});
		}
	};
}

// ----------"Публикация"------------------------------------------------
	// убираем фон
currentImage.src = '';

	// скрываем пункты меню для режима "Публикации"
menu.dataset.state = 'initial';
wrapApp.dataset.state = '';
hide(menuBurger);

	// убираем комментарии в режиме "Публикации"
wrapApp.removeChild(formsComments);

menuNewPic.addEventListener('click', uploadFileFromInput);
wrapApp.addEventListener('drop', onFilesDrop);
wrapApp.addEventListener('dragover', event => event.preventDefault());

	// Загрузка изображения
function uploadFileFromInput(event) {
	hide(error);
		//добавим форму для вызова окна "выбора файла"
	const input = document.createElement('input');
	input.setAttribute('id', 'fileInput');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', 'image/jpeg, image/png');
	hide(input);
	menu.appendChild(input);

	document.querySelector('#fileInput').addEventListener('change', event => {
		const files = Array.from(event.currentTarget.files);
		sendFile(files);
	});

	input.click();
	menu.removeChild(input);
}

	// drag & drop изображения для загрузки
function onFilesDrop(event) {
	event.preventDefault();
	hide(error);
	const files = Array.from(event.dataTransfer.files);
	
	if (count > 0) {
		error.removeAttribute('style');
		error.lastElementChild.textContent = errorMoreDrag;
		errorRemove();
		return;
	}

	count++;
	files.forEach(file => {
		if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
			sendFile(files);
		} else {
			error.removeAttribute('style');
			count = 0;
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

	loader.removeAttribute('style');

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
			hide(loader);
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
	host = `${window.location.origin}${window.location.pathname}?id=${dataGetParse.id}`;

	wss();	
	setcurrentImage(dataGetParse);
	menuBurger.style.cssText = ``;
	showMenu();

	currentImage.addEventListener('load', () => {
		hide(loader);
		createWrapforCanvasComment();
		createCanvas();
	});

	updateCommentForm(dataGetParse.comments);
}

// ----------"Рецензирование"-----------------------------------------------

menuBurger.addEventListener('click', showMenu);
	// раскрытие инструментов пунктов меню
function showMenu() {
	menu.dataset.state = 'default';

	Array.from(menu.querySelectorAll('.mode')).forEach(modeItem => {
		modeItem.dataset.state = ''
		modeItem.addEventListener('click', () => {
			
			if (!modeItem.classList.contains('new')){
				menu.dataset.state = 'selected';
				modeItem.dataset.state = 'selected';
			}
			
			if (modeItem.classList.contains('share')) {
				menuUrl.value = host;
			}
		})
	})
}

function showMenuComments() {
	menu.dataset.state = 'default';

	Array.from(menu.querySelectorAll('.mode')).forEach(modeItem => {
		if (!modeItem.classList.contains('comments')){ return; }
			
		menu.dataset.state = 'selected';
		modeItem.dataset.state = 'selected';
	})
}




	// добавляем фон 
function setcurrentImage(fileInfo) {
	currentImage.src = fileInfo.url;
}

	// ------------Комментарии
canvas.addEventListener('click', checkComment);

commentsMarkerCheckboxOn.addEventListener('click', markerCheckboxOn);
commentsMarkerCheckboxOff.addEventListener('click', markerCheckboxOff);
toggleOn.addEventListener('click', markerCheckboxOn);
toggleOff.addEventListener('click', markerCheckboxOff);

function markerCheckboxOff() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = 'none';
	 })
}

function markerCheckboxOn() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = '';
	})
}

function checkComment() {
	if (!(menuСomments.dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) { return; }
	wrapCommentsCanvas.appendChild(createCommentForm(event.offsetX, event.offsetY));
}
	
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
}

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

	const loaderComment = formComment.querySelector('.loader');
	hide(loaderComment.parentElement);

	//кнопка закрыть
	formComment.querySelector('.comments__close').addEventListener('click', () => {
		formComment.querySelector('.comments__marker-checkbox').checked = false;
	});

	// кнопка отправить
	formComment.addEventListener('submit', messageSend);
	formComment.querySelector('.comments__input').addEventListener('keydown', keySendMessage);

	// отправка сообжения по нажатию Ctrl + Enter
	function keySendMessage(event) {
		if (event.repeat) { return; }
		if (!event.ctrlKey) { return; }

		switch (event.code) {
			case 'Enter':
				messageSend();
			break;
		}
	}

	function messageSend(event) {
		if (event) {
			event.preventDefault();
		}
		const message = formComment.querySelector('.comments__input').value;
		const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
		commentsSend(messageSend);
		loaderComment.parentElement.removeAttribute('style');
		formComment.querySelector('.comments__input').value = '';
	}

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
				console.log(er)
				formComment.querySelector('.loader').parentElement.style.display = 'none';
			});
	}

	return formComment;
}

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

function insertWssCommentForm(wssComment) {
	const wsCommentEdited = {};
	wsCommentEdited[wssComment.id] = {};
	wsCommentEdited[wssComment.id].left = wssComment.left;
	wsCommentEdited[wssComment.id].message = wssComment.message;
	wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
	wsCommentEdited[wssComment.id].top = wssComment.top;
	updateCommentForm(wsCommentEdited);
}

let connection;
function wss() {
	let urlMask;
	connection = new WebSocket(`${urlWss}/${dataGetParse.id}`);
	connection.addEventListener('message', event => {
		console.log(JSON.parse(event.data));
		if (JSON.parse(event.data).event === 'pic'){
			if (JSON.parse(event.data).pic.mask) {
				canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
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

// ------------Поделиться
// копируем ссылку по клику на кнопку "Копировать" в режиме "Поделиться"
const copyUrl = document.querySelector('.menu_copy');  
copyUrl.addEventListener('click', function(event) {  
	// выбрали текст
	menuUrl.select();
	try {  
		//выполним команду копирования	
		var successful = document.execCommand('copy');  
		var msg = successful ? 'успешно ' : 'не';  
		console.log(`URL ${msg} скопирован`);  
	} catch(err) {  
		console.log('Ошибка копирования');  
	}  
	window.getSelection().removeAllRanges();
});

// Получаем из ссылки параметр id
let urlString = `${window.location.href}`;
let url = new URL(urlString);
let paramId = url.searchParams.get('id');
urlId();

function urlId() {
	if (!paramId) { return;	}
	setReview(paramId);
	showMenuComments()
}

// ------------Рисование
let currColor;

Array.from(menu.querySelectorAll('.menu__color')).forEach(color => {
	if (color.checked) {
		currColor = getComputedStyle(color.nextElementSibling).backgroundColor;
	}

	color.addEventListener('click', (event) => {
		currColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor;
	});
});

const ctx = canvas.getContext('2d');
const BRUSH_RADIUS = 4;
let curves = [];
let drawing = false;
let needsRepaint = false;

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

function makePoint(x, y) {
	return [x, y];
};

canvas.addEventListener("mousedown", (event) => {
	if (!(menuDraw.dataset.state === 'selected')) return;
	drawing = true;

	const curve = []; 
	curve.color = currColor;

	curve.push(makePoint(event.offsetX, event.offsetY)); 
	curves.push(curve); 
	needsRepaint = true;
});

canvas.addEventListener("mouseup", (event) => {
	drawing = false;
});

canvas.addEventListener("mouseleave", (event) => {
	drawing = false;
});

canvas.addEventListener("mousemove", (event) => {
	if (drawing) {
		const point = makePoint(event.offsetX, event.offsetY)
		curves[curves.length - 1].push(point);
		needsRepaint = true;
		trottledSendMask();
	}
});

 const trottledSendMask = throttleCanvas(sendMaskState, 1000);

function repaint () {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	curves.forEach((curve) => {
		ctx.strokeStyle = curve.color;
		ctx.fillStyle = curve.color;

		circle(curve[0]);
		smoothCurve(curve);
	});
}

function sendMaskState() {
	canvas.toBlob(function (blob) {
		connection.send(blob);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	});
}

function throttleCanvas(callback, delay) {
	let isWaiting = false;
	return function () {
		if (!isWaiting) {
			isWaiting = true;
			setTimeout(() => {
				callback();
				isWaiting = false;
			}, delay);
		}
	}
}

//--------------------------

function tick () {
	// Двигаем меню если оно находится с края окна и не помещается при развертывании
	if (menu.offsetHeight > 66) {
		menu.style.left = (wrapApp.offsetWidth - menu.offsetWidth) - 10 + 'px';
	}
	// Отрисовываем 
	if(needsRepaint) {
		repaint();
		needsRepaint = false;
	}

	window.requestAnimationFrame(tick);
}

tick();

//закрываем соединение при уходе со страницы
window.addEventListener('beforeunload', () => { connection.close() });