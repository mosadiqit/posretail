odoo.define('pos_retail.synchronization', function (require) {
    var models = require('point_of_sale.models');
    var rpc = require('pos.rpc');
    var Backbone = window.Backbone;
    var Session = require('web.Session');
    var screens = require('point_of_sale.screens');
    var db = require('point_of_sale.DB');
    var session = require('web.session');
    var RetailOrder = require('pos_retail.order');
    var exports = {};
    var core = require('web.core');
    var _t = core._t;

    models.load_models([
        { // TODO: for offline mode
            model: 'pos.iot',
            condition: function (self) {
                if (self.config.sync_multi_session_offline && self.config.sync_multi_session_offline_iot_ids.length) {
                    return true
                } else {
                    return false;
                }
            },
            fields: [],
            domain: function (self) {
                return [['id', 'in', self.config.sync_multi_session_offline_iot_ids]]
            },
            loaded: function (self, iot_boxes) {
                self.iot_boxes = iot_boxes;
                self.iot_box_by_id = {};
                self.iot_connections = [];
                for (var i = 0; i < iot_boxes.length; i++) {
                    var iot_box = iot_boxes[i];
                    var iot_url = 'http://' + iot_box.proxy + ':' + iot_box.port;
                    self.iot_box_by_id[iot_boxes[i].id] = iot_boxes[i];
                    var iot_connection = new Session(void 0, iot_url, {
                        use_cors: true
                    });
                    if (iot_box.screen_kitchen) {
                        iot_connection['screen_kitchen'] = iot_box['screen_kitchen'];
                        iot_connection['login_kitchen'] = iot_box['login_kitchen'];
                        iot_connection['password_kitchen'] = iot_box['password_kitchen'];
                        iot_connection['odoo_public_proxy'] = iot_box['odoo_public_proxy']
                    }
                    self.iot_connections.push(iot_connection)
                }
            }
        },
        { // TODO: for online mode. sync direct to odoo server
            label: 'init sync connection',
            condition: function (self) {
                if (self.config.sync_multi_session && !self.config.sync_multi_session_offline) {
                    return true
                } else {
                    return false;
                }
            },
            loaded: function (self) {
                var iot_url = self.session.origin;
                self.iot_connections = [new Session(void 0, iot_url, {
                    use_cors: true
                })];
            },
        },
    ]);

    screens.OrderWidget.include({
        rerender_orderline: function (orderline) {
            try {
                this._super(orderline);
            } catch (e) {
                return
            }
        }
    });

    exports.pos_bus = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
            this.pos.sync_status = false;
            this.line_uid_queue = {};
            this.lines_missed_order_uid = {};
            this.register_point();
            this.open_kitchen_and_kitchen_waiter_screen();
        },
        set_online: function () {
            this.pos.set('synch', { state: 'connected', pending: 0 });
            this.pos.sync_status = true;
        },
        set_offline: function (total_error) {
            if (!total_error) {
                total_error = 1
            }
            this.pos.set('synch', { state: 'disconnected', pending: total_error });
            if (this.pos.sync_status) {
                this.pos.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Your Odoo Sever or PosBox deceive sync have Offline, Sync between Session is pending.PLease: One Order take control (any event change) by only one POS Session (or Seller)',
                })
            }
            this.pos.sync_status = false;

        },
        // TODO: only for IOT devices POSBOX
        register_point: function () { // TODO: register point to IoT Boxes
            var self = this;
            for (var i = 0; i < this.pos.iot_connections.length; i++) { //
                var iot_connection = this.pos.iot_connections[i];
                var params = {
                    database: this.pos.session.db,
                    config_ids: this.pos.config.sync_to_pos_config_ids,
                    sync_multi_session_offline: this.pos.config.sync_multi_session_offline,
                };
                var sending = function () {
                    return iot_connection.rpc("/pos/register/sync", params, {shadow: true, timeout: 60000});
                };
                sending().then(function (results) {
                    self.set_online();
                    self.get_sync();
                    self.repush_to_another_sessions();
                    self.sync_lines();
                    setTimeout(_.bind(self.register_point, self), 1500);
                }, function (err) {
                    var datas_false = self.pos.db.get_datas_false();
                    self.set_offline(datas_false.length);
                    setTimeout(_.bind(self.register_point, self), 1500);
                })
            }
        },
        get_sync: function () { // TODO: get notifications update from another sessions the same bus id
            var self = this;
            for (var i = 0; i < this.pos.iot_connections.length; i++) { //
                var iot_connection = this.pos.iot_connections[i];
                var params = {
                    database: this.pos.session.db,
                    config_id: this.pos.config.id,
                    session_id: this.pos.pos_session.id,
                    sync_multi_session_offline: this.pos.config.sync_multi_session_offline,
                };
                var sending = function () {
                    return iot_connection.rpc("/pos/get/sync", params, {shadow: true});
                };
                sending().then(function (results) {
                    var notifications = JSON.parse(results)['values'];
                    for (var i = 0; i < notifications.length; i++) {
                        self.pos.get_notifications(notifications[i][2])
                    }
                })
            }
        },
        open_kitchen_and_kitchen_waiter_screen: function () { // TODO: Open chef screen for IoT Boxes
            for (var i = 0; i < this.pos.iot_connections.length; i++) { //
                var iot_connection = this.pos.iot_connections[i];
                if (iot_connection['screen_kitchen']) {
                    var params = {
                        database: this.pos.session.db,
                        link: iot_connection['odoo_public_proxy'],
                        login: iot_connection['login_kitchen'],
                        password: iot_connection['password_kitchen']
                    };
                    var sending = function () {
                        return iot_connection.rpc("/pos/display-chef-screen", params, {shadow: true});
                    };
                    sending().then(function (result) {
                        console.log(result);
                    }, function (err) {
                        console.error(err)
                    })
                }
            }
        },
        sync_all_orders: function () {
            if (this.pos.the_first_load) {
                return;
            }
            var orders = this.pos.get('orders').models;
            if (orders.length == 0) {
                return
            }
            for (var i = 0; i < orders.length; i++) {
                if (orders[i].get_allow_sync()) {
                    this.send_notification({
                        data: orders[i].export_as_JSON(),
                        action: 'new_order',
                    });
                }
            }
        },
        send_notification: function (value) {
            var self = this;
            if (this.pos.config.sync_to_pos_config_ids.length == 0) {
                return this.pos.gui.show_popup({
                    title: _t('Warning'),
                    body: _t('Your POS Setting not add Sync with POS Locations')
                })
            }
            value['device_id'] = this.pos._get_unique_number_pos_session();
            var params = {
                database: this.pos.session.db,
                send_from_config_id: this.pos.config.id,
                config_ids: this.pos.config.sync_to_pos_config_ids,
                message: value,
                sync_multi_session_offline: this.pos.config.sync_multi_session_offline,
            };
            for (var i = 0; i < this.pos.iot_connections.length; i++) { //
                var iot_connection = this.pos.iot_connections[i];
                if (this.pos.sync_status) {
                    var sending = function () {
                        return iot_connection.rpc("/pos/save/sync", params);
                    };
                    sending().then(function () {
                        self.set_online();
                        console.log('save/sync succeed')
                    }, function (err) {
                        self.set_offline();
                        self.pos.db.add_datas_false(value);
                    });
                    if (value['action'] == 'request_printer' || value['action'] == 'set_state') { // TODO: only sync event change to one IoT boxes if not request printer and not set_state
                        continue
                    } else {
                        break
                    }
                } else {
                    this.pos.db.add_datas_false(value);
                }
            }
        },
        repush_to_another_sessions: function () {
            var self = this;
            var datas_false = this.pos.db.get_datas_false();
            if (datas_false && datas_false.length) {
                console.warn('Total Datas waiting sync : ' + datas_false.length);
                var datas_false = self.pos.db.get_datas_false();
                for (var i = 0; i < datas_false.length; i++) {
                    var value = datas_false[i];
                    this.send_notification(value);
                    self.pos.db.remove_data_false(value['sequence']);
                }
            }
        },
        sync_lines: function () {
            for (var line_uid in this.line_uid_queue) {
                if (this.line_uid_queue[line_uid]) {
                    var value = this.line_uid_queue[line_uid];
                    this.send_notification(value);
                    this.line_uid_queue[line_uid] = null
                }
            }
        }
    });

    var button_test_sync = screens.ActionButtonWidget.extend({
        template: 'button_test_sync',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var order = this.pos.get_order();
            var total = 0;
            for (var product_id in this.pos.db.product_by_id) {
                var product = this.pos.db.product_by_id[product_id]
                var line = new models.Orderline({}, {pos: this.pos, order: order, product: product});
                order.orderlines.add(line);
                line.set_unit_price(100);
                line.set_quantity(2);
                line.set_state('Waiting');
                total += 1;
                if (total > 5) {
                    break
                }
            }
        }
    });
    screens.define_action_button({
        'name': 'button_test_sync',
        'widget': button_test_sync,
        'condition': function () {
            // return this.pos.debug;
            return false
        }
    });

    var button_remove_orders = screens.ActionButtonWidget.extend({
        template: 'button_remove_orders',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var orders = this.pos.get('orders').models;
            for (var i = 0; i < orders.length; i++) {
                orders[i].destroy({'reason': 'abandon'})
            }
        }
    });
    screens.define_action_button({
        'name': 'button_remove_orders',
        'widget': button_remove_orders,
        'condition': function () {
            // return this.pos.debug;
            return false
        }
    });

    var button_sync_selected_order = screens.ActionButtonWidget.extend({
        template: 'button_sync_selected_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var self = this;
            this.pos.gui.show_popup('confirm', {
                title: 'Warning',
                body: 'If you click confirm, this selected order will sync to another sessions online. If another sessions have this order before, this order of another sessions will replace by your selected order',
                confirm: function () {
                    var selected_order = this.pos.get_order();
                    if (selected_order) {
                        self.pos.pos_bus.send_notification({
                            data: selected_order.export_as_JSON(),
                            action: 'new_order',
                        });
                    }
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Succeed',
                        body: 'Your selected sync with another sessions online succeed !',
                        color: 'success'
                    })
                }
            });
        }
    });
    screens.define_action_button({
        'name': 'button_sync_selected_order',
        'widget': button_sync_selected_order,
        'condition': function () {
            return this.pos.config.sync_multi_session && this.pos.pos_bus && this.pos.config.sync_manual_button;
        }
    });

    var button_lock_unlock_order = screens.ActionButtonWidget.extend({
        template: 'button_lock_unlock_order',
        button_click: function () {
            var order = this.pos.get_order();
            order['lock'] = !order['lock'];
            order.trigger('change', order);
            if (this.pos.pos_bus) {
                var action;
                if (order['lock']) {
                    action = 'lock_order';
                } else {
                    action = 'unlock_order';
                }
                this.pos.pos_bus.send_notification({
                    data: order.uid,
                    action: action,
                });
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Syncing between sessions not active'
                })
            }
        }
    });

    screens.define_action_button({
        'name': 'button_lock_unlock_order',
        'widget': button_lock_unlock_order,
        'condition': function () {
            return this.pos.config.lock_order_printed_receipt == true;
        }
    });

    db.include({
        add_datas_false: function (data) {
            var datas_false = this.load('datas_false', []);
            this.sequence += 1;
            data['sequence'] = this.sequence;
            datas_false.push(data);
            this.save('datas_false', datas_false);
        },
        get_datas_false: function () {
            var datas_false = this.load('datas_false');
            if (datas_false && datas_false.length) {
                return datas_false
            } else {
                return []
            }
        },
        remove_data_false: function (sequence) {
            var datas_false = this.load('datas_false', []);
            var datas_false_new = _.filter(datas_false, function (data) {
                return data['sequence'] !== sequence;
            });
            this.save('datas_false', datas_false_new);
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var self = this;
            _super_PosModel.initialize.apply(this, arguments);
            this.bind('change:selectedOrder', function () {
                var selectedOrder = self.get_order();
                if (self.pos_bus && self.config && selectedOrder && !selectedOrder.syncing && self.config.screen_type != 'kitchen') {
                    self.pos_bus.send_notification({
                        action: 'selected_order',
                        data: {
                            uid: selectedOrder['uid']
                        },
                    });
                }
            });
        },
        _get_unique_number_pos_session: function () { // TODO: this is unique number base on 1 browse open, we dont care the same config or the same pos session
            return this.pos_session.login_number + '_' + this.config.id;
        },
        load_orders: function () {
            this.the_first_load = true;
            _super_PosModel.load_orders.apply(this, arguments);
            this.the_first_load = false;
        },
        on_removed_order: function (removed_order, index, reason) { // TODO: no need change screen when syncing remove order
            if (removed_order.syncing == true) {
                return;
            } else {
                var res = _super_PosModel.on_removed_order.apply(this, arguments);
            }
        },
        get_order_by_uid: function (uid) {
            var orders = this.get('orders').models;
            var order = orders.find(function (order) {
                return order.uid == uid;
            });
            return order;
        },
        get_line_by_uid: function (uid) {
            var orders = this.get('orders').models;
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var line = _.find(order.orderlines.models, function (line) {
                    return line.uid == uid
                });
                if (line) {
                    return line
                }
            }
            return null;
        },
        get_notifications: function (message) {
            var action = message['action'];
            console.log(action);
            if (action == 'selected_order') {
                this.sync_selected_order(message['data']);
            }
            if (action == 'new_order') {
                this.sync_order_adding(message['data']);
            }
            if (action == 'unlink_order' || action == 'paid_order') {
                this.sync_order_removing(message['data']);
            }
            if (action == 'line_removing') {
                this.sync_line_removing(message['data']);
            }
            if (action == 'set_client') {
                this.sync_set_client(message['data']);
            }
            if (action == 'trigger_update_line') {
                this.sync_trigger_update_line(message['data']);
            }
            if (action == 'change_pricelist') {
                this.sync_change_pricelist(message['data']);
            }
            if (action == 'set_line_note') {
                this.sync_set_line_note(message['data']);
            }
            if (action == 'lock_order') {
                this.sync_lock_order(message['data']);
            }
            if (action == 'unlock_order') {
                this.sync_unlock_order(message['data']);
            }
        },
        sync_lock_order: function (uid) {
            var order = this.get_order_by_uid(uid);
            if (order) {
                order.lock = true;
                var current_order = this.get_order();
                if (this.config.lock_order_printed_receipt && current_order && current_order['uid'] == order['uid']) {
                    this.lock_order()
                }
                order.trigger('change', order);
                return true
            }
        },
        sync_unlock_order: function (uid) {
            var order = this.get_order_by_uid(uid);
            if (order) {
                order.lock = false;
                var current_order = this.get_order();
                if (current_order && current_order['uid'] == order['uid']) {
                    this.unlock_order()
                }
                return true
            }
        },
        sync_selected_order: function (vals) {
            if (!this.config.is_customer_screen) {
                $('.extra_functions').addClass('oe_hidden');
                return true;
            }
            var order = this.get_order_by_uid(vals['uid']);
            if (!order) {
                return false;
            } else {
                if (order) {
                    this.set('selectedOrder', order);
                    var order = this.get_order();
                    $('.pos .leftpane').css('left', '0px');
                    $('.pos .rightpane').css('left', '440px');
                    if (order && order.orderlines.length) {
                        var $orderwidget = $('.order-scroller');
                        $orderwidget.scrollTop(1000000);
                        $('.btn').remove();
                        $('.bus-info').remove();
                        $('.oe_link_icon').remove();
                    }
                }
                return true;
            }
        },
        sync_order_adding: function (vals) {
            var order = this.get_order_by_uid(vals['uid']);
            if (order) {
                this.sync_order_removing(vals['uid']);
            }
            var orders = this.get('orders');
            if (vals.floor_id && vals.table_id) {
                if (this.floors_by_id && this.floors_by_id[vals.floor_id] && this.tables_by_id && this.tables_by_id[vals.table_id]) {
                    var table = this.tables_by_id[vals.table_id];
                    var floor = this.floors_by_id[vals.floor_id];
                    if (table && floor) {
                        this.the_first_load = true;
                        var order = new models.Order({}, {pos: this, json: vals});
                        if (vals['sequence_number']) {
                            order['sequence_number'] = vals['sequence_number']
                        }
                        orders.add(order);
                        order.trigger('change', order);
                        this.the_first_load = false;
                    }
                }
            } else {
                if (this.floors != undefined) {
                    if (this.floors.length > 0) {
                        return null;
                    }
                }
                this.the_first_load = true;
                var order = new models.Order({}, {pos: this, json: vals});
                order.syncing = true;
                if (vals['sequence_number']) {
                    order['sequence_number'] = vals['sequence_number']
                }
                orders.add(order);
                order.trigger('change', order);
                order.syncing = false;
                if (orders.length == 1) {
                    this.set('selectedOrder', order);
                }
                this.the_first_load = false;
            }
            if (this.pos_bus.lines_missed_order_uid[vals['uid']]) {
                var lines_missed_sync = this.pos_bus.lines_missed_order_uid[vals['uid']];
                for (var i = 0; i < lines_missed_sync.length; i++) {
                    this.sync_trigger_update_line(lines_missed_sync[i])
                }
                this.pos_bus.lines_missed_order_uid[vals['uid']] = [];
            }
        },
        has_pos_restaurant_installed: function () {
            return this.config.module_pos_restaurant && this.config.floor_ids && this.config.floor_ids.length > 0;
        },
        sync_order_removing: function (uid) {
            var self = this;
            var has_setting_restaurant = this.has_pos_restaurant_installed();
            var order = this.get_order_by_uid(uid);
            if (order) {
                var selected_order = this.get_order();
                order.syncing = true;
                if (selected_order && selected_order['uid'] == order['uid'] && has_setting_restaurant) {
                    this.gui.show_screen('floors') // Go to floors screen if order selected remove
                }
                this.db.remove_order(order.id);
                order.destroy({'reason': 'abandon'});
                if (selected_order && selected_order['uid'] == order['uid'] && !has_setting_restaurant) {
                    if (this.gui.popup_instances['dialog']) {
                        this.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Order Selected Paid or Remove, please select another Order')
                        });
                    }
                    setTimeout(function () {
                        var orders = self.get('orders').models;
                        if (orders.length) {
                            self.set_order(orders[orders.length - 1]);
                        } else {
                            self.add_new_order();
                        }
                    }, 1000)
                }
            }
        },
        sync_set_client: function (vals) {
            var partner_id = vals['partner_id'];
            var uid = vals['uid'];
            var client = this.db.get_partner_by_id(partner_id);
            var order = this.get_order_by_uid(uid);
            if (!order || order.finalized == true) { // if not order or order final submitted backend, return
                return false;
            }
            if (!partner_id) {
                order.syncing = true;
                order.set_client(null);
                order.syncing = false;
                return order.trigger('change', order)
            }
            if (!client) {
                var self = this;
                return rpc.query({
                    model: 'res.partner',
                    method: 'search_read',
                    args: [[['id', '=', partner_id]]],
                }).then(function (partners) {
                    if (partners.length == 1) {
                        self.db.add_partners(partners);
                        order.syncing = true;
                        order.set_client(partners[0]);
                        order.trigger('change', order);
                        order.syncing = false;
                    } else {
                        console.errorg('Loading new partner fail networking')
                    }
                }, function (error) {
                    return self.pos.query_backend_fail(error);
                })
            } else {
                order.syncing = true;
                order.set_client(client);
                order.trigger('change', order);
                order.syncing = false;
            }
        },
        sync_change_pricelist: function (vals) {
            var order = this.get_order_by_uid(vals['uid']);
            var pricelist = _.findWhere(this.pricelists, {id: vals['pricelist_id']});
            if (!order || !pricelist) {
                console.warn('sync pricelist but have difference pricelist between 2 sessions');
                return null
            }
            if (order && pricelist) {
                order.pricelist = pricelist;
                order.trigger('change', order);
            }
        },
        sync_trigger_update_line: function (vals) {
            var self = this;
            var line = self.get_line_by_uid(vals['uid']);
            var order = self.get_order_by_uid(vals['line']['order_uid']);
            var json = vals['line'];
            if (line) {
                line.syncing = true;
                if (json.note) {
                    line.set_line_note(json.note)
                }
                line.set_quantity(json['qty']);
                line.set_discount(json.discount);
                line.set_unit_price(json.price_unit);
                line.syncing = false;
            } else {
                if (order) {
                    var product_id = vals.line.product_id;
                    var product = this.db.get_product_by_id(product_id);
                    if (!product) {
                        console.warn('Product Id: ' + product_id + ' not exist in this session');
                        return false;
                    }
                    order.syncing = true;
                    order.add_orderline(new models.Orderline({}, {pos: this, order: order, json: json}));
                    order.syncing = false;
                } else {
                    if (!this.pos_bus.lines_missed_order_uid[json['order_uid']]) {
                        this.pos_bus.lines_missed_order_uid[json['order_uid']] = [vals]
                    } else {
                        this.pos_bus.lines_missed_order_uid[json['order_uid']] = this.pos_bus.lines_missed_order_uid[json['order_uid']].concat(vals)
                    }
                }
            }
        },
        sync_set_line_note: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) {
                line.syncing = true;
                line.set_line_note(vals['note']);
                line.syncing = false;
                return true
            }
        },
        sync_line_removing: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) {
                line.syncing = true;
                line.order.orderlines.remove(line);
                line.order.trigger('change', line.order);
                line.syncing = false;
            }
        },
        session_info: function () {
            var user;
            if (this.get('cashier')) {
                user = this.get('cashier');
            } else {
                user = this.user;
            }
            return {
                'user': {
                    'id': user.id,
                    'name': user.name
                },
                'pos': {
                    'id': this.config.id,
                    'name': this.config.name
                },
                'date': new Date().toLocaleTimeString()
            }
        },
        get_session_info: function () {
            var order = this.get_order();
            if (order) {
                return order.get_session_info();
            }
            return null;
        },
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                if (self.iot_connections && self.iot_connections.length) {
                    self.pos_bus = new exports.pos_bus(self);
                }
                return true;
            })
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
            var res = _super_order.initialize.apply(this, arguments);
            if (!this.created_time) {
                this.created_time = new Date().toLocaleTimeString();
            }
            if (this.pos.pos_bus) {
                this.bind('add', function (order) {
                    if (order.get_allow_sync()) {
                        self.pos.pos_bus.send_notification({
                            data: order.export_as_JSON(),
                            action: 'new_order',
                        });
                    }
                });
                this.bind('remove', function (order) {
                    if (order.get_allow_sync()) {
                        self.pos.pos_bus.send_notification({
                            data: order.uid,
                            action: 'unlink_order'
                        });
                        self.pos.trigger('update:count_item');
                    }
                });
                this.orderlines.bind('add', function (line) {
                    if (line.get_allow_sync()) {
                        line.trigger_update_line();
                    }
                });
            }
            if (!this.session_info) {
                this.session_info = this.pos.session_info();
            }
            return res;
        },
        get_order_session_info: function () {
            if (this.session_info) {
                return this.session_info
            } else {
                this.session_info = this.pos.session_info();
                return this.session_info
            }
        },
        init_from_JSON: function (json) {
            this.syncing = json.syncing;
            _super_order.init_from_JSON.apply(this, arguments);
            this.uid = json.uid;
            if (json.session_info) {
                this.session_info = json.session_info;
            }
            if (json.created_time) {
                this.created_time = json.created_time;
            }
            if (json.last_write_date) {
                this.last_write_date = json.last_write_date;
            }
            if (json.session_info) {
                this.session_info = json.session_info;
            } else {
                this.session_info = this.pos.session_info();
            }
            this.syncing = false;
        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.session_info) {
                json.session_info = this.session_info;
            }
            if (this.uid) {
                json.uid = this.uid;
            }
            if (this.temporary) {
                json.temporary = this.temporary;
            }
            if (this.created_time) {
                json.created_time = this.created_time;
            }
            if (this.last_write_date) {
                json.last_write_date = this.last_write_date;
            }
            return json;
        },
        finalize: function () {
            _super_order.finalize.apply(this, arguments)
            if (this.get_allow_sync()) {
                this.pos.pos_bus.send_notification({
                    data: this.uid,
                    action: 'paid_order',
                });
            }
        },
        get_session_info: function () {
            return this.session_info;
        },
        set_client: function (client) {
            var self = this;
            var order = this.pos.get_order();
            if (order && this.pos.config.add_customer_before_products_already_in_shopping_cart && order.orderlines.length != 0) {
                return self.pos.gui.show_popup('dialog', {
                    title: 'WARNING',
                    from: 'top',
                    align: 'center',
                    body: 'PRODUCTS ALREADY IN SHOPPING CART ,  PLEASE EMPTY CART BEFORE SELECTING CUSTOMER',
                    color: 'danger',
                });
            }
            var res = _super_order.set_client.apply(this, arguments);
            if (!order) {
                return;
            }
            if (order && client) {
                var medical_insurance = this.pos.db.insurance_by_partner_id[client.id];
                if (medical_insurance) {
                    order.medical_insurance = medical_insurance;
                    order.trigger('change', order);
                    self.pos.trigger('change:medical_insurance');
                }
            }
            if (client && client['property_product_pricelist']) {
                var pricelist_id = client['property_product_pricelist'][0];
                var pricelist = _.find(this.pos.pricelists, function (pricelist) {
                    return pricelist['id'] == pricelist_id;
                });
                if ((this.pos.server_version in [11, 12]) && pricelist && !this.is_return) { // we're don't want set price list for order return
                    this.set_pricelist(pricelist)
                }
                if (this.pos.server_version == 10 && pricelist && !this.is_return) { // we're don't want set price list for order return
                    this.set_pricelist_to_order(pricelist)
                }
            }
            if (client && client['property_account_position_id']) { // if client have fiscal position auto change tax amount
                var property_account_position_id = client['property_account_position_id'][0];
                var fiscal_potion = _.find(this.pos.fiscal_positions, function (fiscal) {
                    return fiscal.id == property_account_position_id;
                });
                if (fiscal_potion && order) {
                    order.fiscal_position = fiscal_potion;
                    _.each(order.orderlines.models, function (line) {
                        line.set_quantity(line.quantity);
                    });
                    order.trigger('change');
                }
            }
            if (client && !client['property_account_position_id']) { // if client have not fiscal position, auto reset to default fiscal postion config on pos config
                if (!this.pos.config.fiscal_position_auto_detect) {
                    var default_fiscal_position_id = this.pos.config.default_fiscal_position_id[0];
                    var fiscal_potion = _.find(this.pos.fiscal_positions, function (fiscal) {
                        return fiscal.id == default_fiscal_position_id;
                    });
                    if (fiscal_potion && order) {
                        order.fiscal_position = fiscal_potion;
                        _.each(order.orderlines.models, function (line) {
                            line.set_quantity(line.quantity);
                        });
                        order.trigger('change');
                    }
                } else {
                    rpc.query({
                        model: 'account.fiscal.position',
                        method: 'get_fiscal_position',
                        args: [client['id'], client['id']],
                        context: {}
                    }).then(function (fiscal_potion_id) {
                        var order = self.pos.get_order();
                        var fiscal_potion = _.find(self.pos.fiscal_positions, function (fiscal) {
                            return fiscal.id == fiscal_potion_id;
                        });
                        if (fiscal_potion) {
                            order.fiscal_position = fiscal_potion;
                            _.each(order.orderlines.models, function (line) {
                                line.set_quantity(line.quantity);
                            });
                            order.trigger('change');
                        }
                    })
                }
            }
            if (this.get_allow_sync()) {
                if (client) {
                    this.pos.pos_bus.send_notification({
                        data: {
                            uid: order['uid'],
                            partner_id: client.id
                        },
                        action: 'set_client'
                    });
                }
                if (!client) {
                    this.pos.pos_bus.send_notification({
                        data: {
                            uid: order['uid'],
                            partner_id: null
                        },
                        action: 'set_client'
                    });
                }
            }
            return res;
        },
        get_allow_sync: function () {
            if (this.pos.pos_bus && (this.syncing != true || !this.syncing) && this.pos.pos_bus && this.pos.the_first_load == false) {
                return true
            } else {
                return false
            }
        },
        set_pricelist: function (pricelist) {
            if (!this.is_return) { // if order return, block change pricelist
                _super_order.set_pricelist.apply(this, arguments);
            }
            if (this.get_allow_sync()) {
                this.pos.pos_bus.send_notification({
                    data: {
                        uid: this['uid'],
                        pricelist_id: pricelist['id']
                    },
                    action: 'change_pricelist'
                });
            }
        },
    });

    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            var res = _super_order_line.initialize.apply(this, arguments);
            if (!this.session_info) {
                this.session_info = this.pos.session_info();
            }
            if (!this.uid) {
                this.uid = this.order.uid + '-' + this.pos.pos_session.login_number + this.pos.config.id + this.pos.user.id + this.id;
            }
            this.order_uid = this.order.uid;
            this.bind('trigger_update_line', function () {
                self.trigger_update_line();
            });
            if (this.pos.pos_bus) {
                this.bind('remove', function () {
                    this.trigger_line_removing();
                })
            }
            return res;
        },
        init_from_JSON: function (json) {
            if (json['pack_lot_ids']) {
                json.pack_lot_ids = [];
            }
            var res = _super_order_line.init_from_JSON.apply(this, arguments);
            this.uid = json.uid;
            this.session_info = json.session_info;
            return res;
        },
        export_as_JSON: function () {
            var json = _super_order_line.export_as_JSON.apply(this, arguments);
            json.uid = this.uid;
            json.session_info = this.session_info;
            json.order_uid = this.order.uid;
            return json;
        },
        get_allow_sync: function () {
            if (this.pos.pos_bus && (!this.syncing || this.syncing == false) && (this.order.syncing == false || !this.order.syncing) && (this.uid && this.order.temporary == false)) {
                return true
            } else {
                return false
            }
        },
        set_line_note: function (note) {
            _super_order_line.set_line_note.apply(this, arguments);
            if (this.get_allow_sync()) {
                this.trigger_update_line();
            }
        },
        set_quantity: function (quantity, keep_price) {
            _super_order_line.set_quantity.apply(this, arguments);
            if (this.get_allow_sync() && quantity != 'remove') {
                this.trigger_update_line();
            }
        },
        set_discount: function (discount) {
            _super_order_line.set_discount.apply(this, arguments);
            if (this.get_allow_sync()) {
                this.trigger_update_line();
            }
        },
        set_unit_price: function (price) {
            _super_order_line.set_unit_price.apply(this, arguments);
            if (this.get_allow_sync()) {
                this.trigger_update_line();
            }
        },
        trigger_update_line: function () {
            if (this.get_allow_sync()) {
                this.pos.pos_bus.line_uid_queue[this.uid] = {
                    action: 'trigger_update_line',
                    data: {
                        uid: this.uid,
                        line: this.export_as_JSON()
                    },
                }
            }
        },
        trigger_line_removing: function () {
            if (this.get_allow_sync()) {
                this.pos.pos_bus.line_uid_queue[this.uid] = {
                    action: 'line_removing',
                    data: {
                        uid: this.uid,
                    },
                };
            }
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_order_line.can_be_merged_with.apply(this, arguments);
            if (orderline.seller && this.seller && orderline.seller.id != this.seller.id) {
                return false
            }
            return merge
        },
    });

    return exports;
});
