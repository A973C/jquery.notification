/**
 * @fileOverview Реализация апи нотификатора
 *
 * @see http://www.chromium.org/developers/design-documents/desktop-notifications/api-specification
 * @see http://www.html5rocks.com/en/tutorials/notifications/quick/
 *
 * @author azproduction
 */
jQuery.notification = (function ($, window) {

/**
 * Notification
 *
 * @constructor
 *
 * @param {Object}   options                  если бедут передан url то будет создана нотификация с HTML контентом иначе
 *                                            будет использован обычный режим c icon & title & content
 * @param {String}   [options.url]
 * @param {String}   [options.icon]
 * @param {String}   [options.title]
 * @param {String}   [options.content]
 * @param {String}   [options.replaceId]      действует как window.name в функции window.open
 * @param {Function} [options.onclick]
 * @param {Function} [options.onclose]
 * @param {Function} [options.ondisplay]
 * @param {Function} [options.onerror]
 * @param {Boolean}  [options.autoclose=true] Закрыть при клике на блок? Крестик закрытия очень мал и его сложно поймать
 *                                            поэтому автозакрытие по умолчанию
 * @param {Number}   [options.timeout=Infinity] Время после которого нотификация скроется автоматически
 * @param {Function} [callback]
 *
 * @example
 *      // Acynchronous
 *      var options = {
 *          icon: 'avatar.png',
 *          title: 'Title',
 *          content: 'Message',
 *          onclick: function () {
 *              console.log('Pewpew');
 *          }
 *      };
 *      var message = $.notification(options, function (isNotificationsAllowed) {
 *          if (isNotificationsAllowed) {
 *              message.show();
 *          }
 *      });
 *
 *      // Synchronous
 *      var message = $.notification(options).show();
 *      // messge will displayed as soon as user permit notifications
 */
var Notification = function (options, callback) {
    if (!(this instanceof Notification)) {
        return new Notification(options, callback);
    }
    options = options || {};
    options.autoclose = options.autoclose || true;
    callback = callback || $.noop;
    var self = this;

    // Нотификация доступна
    if (!window.webkitNotifications) {
        return callback(false);
    }

    // Запрашиваем доступ
    // 1 undefined
    // 2 forbidden
    // 0 allowed
    this.notificationStatus = window.webkitNotifications.checkPermission();
    this.monitorPermission(function (isNotificationsAllowed) {
        if (!isNotificationsAllowed) { // Пользователь запретил
            return callback(isNotificationsAllowed);
        }

        // Пользователь разрешил
        self.instance = options.url ?
                        self.create(options.url) :
                        self.create(options.icon, options.title, options.content);

        options.onclick && self.instance.addEventListener('click', options.onclick, false);
        if (options.autoclose) {
            self.instance.addEventListener('click', function(){
                self.cancel();
            }, false);
        }
        options.onclose && self.instance.addEventListener('close', options.onclose, false);
        options.ondisplay && self.instance.addEventListener('display', options.ondisplay, false);
        options.onerror && self.instance.addEventListener('error', options.onerror, false);

        self.instance.replaceId = options.replaceId || "";
        self.timeout = options.timeout || Infinity;
        // show already called
        if (self.isShowCalled) {
            self.show();
        }
        callback(isNotificationsAllowed);
    });
};

Notification.queue = [];
Notification.isAccessRequested = false;
Notification.callQueue = function (isNotificationsAllowed) {
    for (var i = 0, c = Notification.queue.length; i < c; i++) {
        Notification.queue[i](isNotificationsAllowed);
    }
    Notification.queue = [];
};

Notification.prototype = {
    constructor: Notification,

    notificationStatus: 1,
    isShowCalled: false,
    timeout: Infinity,
    instance: null,

    /**
     * Показывает блок
     */
    show: function () {
        var self = this;
        if (this.instance) {
            this.instance.show();
            if (isFinite(this.timeout)) {
                window.setTimeout(function () {
                    self.cancel();
                }, this.timeout);
            }
        } else {
            this.isShowCalled = true;
        }

        return this;
    },

    /**
     * Скрывает блок
     */
    cancel: function () {
        if (this.instance) {
            this.instance.cancel();
        }

        return this;
    },

    /**
     * Создает инстанс объекта нотификации и биндит на него события
     *
     * @param {String} page_url_or_icon
     * @param {String} [title]
     * @param {String} [content]
     */
    create: function (page_url_or_icon, title, content) {
        var instance,
            self = this;

        // create instance
        if (arguments.length === 1) {
            instance = window.webkitNotifications.createHTMLNotification(page_url_or_icon);
        } else {
            instance = window.webkitNotifications.createNotification(page_url_or_icon, title, content);
        }

        return instance;
    },

    /**
     * Проверяет можно ли показывать нотификацию
     *
     * @param {Function} callback(isNotificationsAllowed)
     */
    monitorPermission: function(callback) {
        var self = this;

        if (this.notificationStatus === 1) { // Пользователь еще не выбрал, либо мы не показали запрос
            Notification.queue.push(callback); // Добавляем в очередь
            if (Notification.isAccessRequested) { // Если уже один раз запросили, то выходим запросы уже в очереди
                return;
            }
        } else { // пользователь уже решил
            callback(this.notificationStatus === 0);
            return;
        }

        Notification.isAccessRequested = true;

        $(document).one('click', function () {
            window.webkitNotifications.requestPermission();
        });

        var checkPermissionInterval = window.setInterval(function () {
            self.notificationStatus = window.webkitNotifications.checkPermission();
            if (self.notificationStatus === 1) {
                return; // Пользователь еще не решил
            }
            window.clearInterval(checkPermissionInterval);
            Notification.callQueue(self.notificationStatus === 0); // 2 запрещено, 0 разрешено
        }, 200);
    }
};

return Notification;

}(jQuery, window));