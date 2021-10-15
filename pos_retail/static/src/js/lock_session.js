odoo.define('pos_retail.lock_session', function (require) {
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');

    chrome.Chrome.include({
        unlock_pos_screen: function () {
            this.pos.set('lock_status', {state: 'connecting', pending: 0});
            $('.pos-topheader').addClass('oe_hidden');
            $('.pos-content').addClass('oe_hidden');
            this.pos.gui.show_popup('popup_lock_page', {
                title: 'Locked',
                body: 'Your session have locked, please input POS Pass Pin of User Login Odoo'
            });
        },
        build_widgets: function () {
            var self = this;
            this._super();
            if (this.pos.config.allow_lock_screen || this.pos.config.lock_state == 'locked') {
                setTimeout(function () {
                    self.unlock_pos_screen();
                }, 200);
            }
        }
    });

    var popup_lock_page = PopupWidget.extend({
        template: 'popup_lock_page',
        login: function () {
            var pos_security_pin = this.$('.input_form').val();
            if (pos_security_pin != this.pos.user.pos_security_pin) {
                var message = 'Input could not blank or your pos pass pin not correct';
                return this.wrong_input("input[class='input_form']", message);
            }
            if (!this.pos.user.pos_security_pin) {
                var message = 'User ' + this.pos.user['name'] + ' not set pos pass pin. Please go to Setting / Users / Point of sale tab and input';
                return this.wrong_input("input[class='input_form']", message);
            }
            this.pos.set('lock_status', {state: 'connected', pending: 0});
            rpc.query({
                model: 'pos.config',
                method: 'lock_session',
                args: [[parseInt(this.pos.config.id)], {
                    lock_state: 'unlock'
                }]
            });
            $('.pos-content').removeClass('oe_hidden');
            $('.pos-topheader').removeClass('oe_hidden');
            return this.pos.gui.close_popup();
        },
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.$('#password').focus();
            this.$('#password').value = "";
            this.$('.login').click(function () {
                self.login()
            });
            this.$('.logout').click(function () {
                self.gui._close();
            });

        }
    });
    gui.define_popup({name: 'popup_lock_page', widget: popup_lock_page});

    var lock_session_widget = chrome.StatusWidget.extend({
        template: 'lock_session_widget',
        lock_session: function () {
            this.pos.gui.show_popup('popup_lock_page', {
                title: 'Locked',
                body: 'Use pos security pin for unlock'
            });
        },
        start: function () {
            var self = this;
            this.pos.bind('change:lock_status', function (pos, datas) {
                self.set_status(datas.state, datas.pending);
            });
            this.$el.click(function () {
                self.pos.set('lock_status', {state: 'connecting', pending: 0});
                $('.pos-topheader').addClass('oe_hidden');
                $('.pos-content').addClass('oe_hidden');
                rpc.query({
                    model: 'pos.config',
                    method: 'lock_session',
                    args: [[parseInt(self.pos.config.id)], {
                        lock_state: 'locked'
                    }]
                });
                self.lock_session();
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'lock_session_widget',
                    'widget': lock_session_widget,
                    'append': '.pos-branding'
                }
            );
            this._super();
        }
    });
});