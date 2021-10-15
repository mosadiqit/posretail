odoo.define('pos_retail.restaurant', function (require) {
    var screens = require('point_of_sale.screens');
    var floors = require('pos_restaurant.floors');
    var gui = require('point_of_sale.gui');
    var sync = require('pos_retail.synchronization');
    var multi_print = require('pos_restaurant.multiprint');
    var models = require('point_of_sale.models');
    var FloorScreenWidget;
    var SplitbillScreenWidget;

    // TODO: for waiters and cashiers
    _.each(gui.Gui.prototype.screen_classes, function (o) {
        if (o.name == 'floors') {
            FloorScreenWidget = o.widget;
            FloorScreenWidget.include({
                start: function () {
                    var self = this;
                    this._super();
                    this.pos.bind('update:floor-screen', function () {
                        self.renderElement();
                    })
                },
            })
        }
        if (o.name == 'splitbill') {
            SplitbillScreenWidget = o.widget;
            SplitbillScreenWidget.include({
                pay: function (order, neworder, splitlines) { // TODO: save event split bill of sessions, when split bill we not send notifications request printer to another sessions
                    this.pos.splitbill = true;
                    var res = this._super(order, neworder, splitlines);
                    this.pos.splitbill = false;
                    return res;
                }
            })
        }
    });

    models.load_models({
        model: 'restaurant.floor',
        fields: ['name', 'background_color', 'table_ids', 'sequence'],
        domain: function (self) {
            return [['id', 'in', self.config.floor_ids]];
        },
        loaded: function (self, floors) {
            self.floor_ids = [];
            self.floors = floors;
            self.floors_by_id = {};
            for (var i = 0; i < floors.length; i++) {
                floors[i].tables = [];
                self.floors_by_id[floors[i].id] = floors[i];
                self.floor_ids.push(floors[i]['id']);
            }
            self.floors = self.floors.sort(function (a, b) {
                return a.sequence - b.sequence;
            });
            // neu len floors >= 1 thi iface_floorplan >= 1
            // va hien thi man hinh floor, table
            self.config.iface_floorplan = !!self.floors.length;
        }
    });
    models.load_models({
        model: 'restaurant.table',
        fields: ['name', 'width', 'height', 'position_h', 'position_v', 'shape', 'floor_id', 'color', 'seats'],
        domain: function (self) {
            return [['floor_id', 'in', self.floor_ids]];
        },
        loaded: function (self, tables) {
            self.tables_by_id = {};
            for (var i = 0; i < tables.length; i++) {
                self.tables_by_id[tables[i].id] = tables[i];
                var floor = self.floors_by_id[tables[i].floor_id[0]];
                if (floor) {
                    floor.tables.push(tables[i]);
                    tables[i].floor = floor;
                }
            }
        }
    });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        set_start_order: function () {
            if (this.config.screen_type && (this.config.screen_type == 'kitchen' || this.config.screen_type == 'kitchen_waiter')) {
                return false
            } else {
                return _super_posmodel.set_start_order.apply(this, arguments);
            }
        },
        set_table: function (table) {
            var self = this;
            if (this.order_to_transfer_to_different_table && table && this.pos_bus) {
                var order_to_transfer_to_different_table = this.order_to_transfer_to_different_table;
                if (order_to_transfer_to_different_table.syncing == false || !order_to_transfer_to_different_table.syncing) {
                    order_to_transfer_to_different_table.syncing = true;
                    this.pos_bus.send_notification({
                        action: 'order_transfer_new_table',
                        data: {
                            uid: order_to_transfer_to_different_table.uid,
                            table_id: table.id,
                            floor_id: table.floor_id[0],
                        },
                        order_uid: order_to_transfer_to_different_table.uid,
                    });
                    order_to_transfer_to_different_table.syncing = false;
                }
            }
            if (!this.pos_bus) {
                _super_posmodel.set_table.apply(this, arguments);
            } else {
                if (!table) { // no table ? go back to the floor plan, see ScreenSelector
                    this.set_order(null);
                } else if (this.order_to_transfer_to_different_table) {
                    this.order_to_transfer_to_different_table.table = table;
                    this.order_to_transfer_to_different_table.save_to_db();
                    this.order_to_transfer_to_different_table = null;

                    // set this table
                    this.set_table(table);

                } else {
                    this.table = table;
                    var orders = this.get_order_list();
                    if (orders.length) {
                        this.set_order(orders[0]); // and go to the first one ...
                    } else {
                        this.add_new_order();  // or create a new order with the current table
                    }
                }
            }
            if (table == null) {
                this.trigger('reset:count_item');
            }
        },
        load_server_data: function () {
            var self = this;
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                self.config.iface_floorplan = self.floors.length;
            });
        },
        // TODO: play sound when new transaction coming
        play_sound: function () {
            var src = "/pos_retail_restaurant/static/src/sounds/demonstrative.mp3";
            $('body').append('<audio src="' + src + '" autoplay="true"></audio>');
        },
        // TODO: sync between sesion on restaurant
        get_notifications: function (message) {
            var action = message['action'];
            _super_posmodel.get_notifications.apply(this, arguments);
            if (action == 'set_state') {
                this.sync_state(message['data']);
            }
            if (action == 'order_transfer_new_table') {
                this.sync_order_transfer_new_table(message['data']);
            }
            if (action == 'set_customer_count') {
                this.sync_set_customer_count(message['data']);
            }
            if (action == 'request_printer') {
                this.sync_request_printer(message['data']);
            }
            if (action == 'set_note') {
                this.sync_set_note(message['data']);
            }
            if (this.floors.length && this.config.screen_type && this.config.screen_type !== 'kitchen') {
                this.trigger('update:floor-screen');
            }
        },
        // TODO: neu la man hinh nha bep / bar
        //         - khong quan tam no la floor hay table hay pos cashier
        //         - luon luon dong bo vs tat ca
        sync_order_adding: function (vals) {
            _super_posmodel.sync_order_adding.apply(this, arguments);
            var order_exist = this.get_order_by_uid(vals['uid']);
            if (order_exist) {
                return;
            } else {
                if (this.config.screen_type !== 'waiter') {
                    var orders = this.get('orders', []);
                    if (vals['floor_id'] && !this.floors_by_id[vals['floor_id']]) {
                        vals['floor_id'] = null;
                    }
                    if (vals['table_id'] && !this.floors_by_id[vals['table_id']]) {
                        vals['table_id'] = null;
                    }
                    var order = new models.Order({}, {pos: this, json: vals});
                    order.syncing = true;
                    orders.add(order);
                    order.trigger('change', order);
                    order.syncing = false;
                }
            }
        },
        sync_line_removing: function (vals) {
            _super_posmodel.sync_line_removing.apply(this, arguments);
            this.trigger('event:line-state', {uid: vals['uid'], state: 'Cancelled'}); // TODO: for kitchen waiters and kitchen chef
        },
        // TODO: update trang thai cua line
        sync_state: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) { // TODO: for waiters and cashiers
                line.syncing = true;
                line.set_state(vals['state']);
                line.syncing = false;
            }
            this.trigger('event:line-state', vals); // TODO: for kitchen waiters and kitchen chef
        },
        // TODO: dong bo khi in xong
        sync_request_printer: function (vals) { // TODO: update variable set_dirty of line
            var order = this.get_order_by_uid(vals.uid);
            var computeChanges = vals.computeChanges || [];
            if (order) {
                order.syncing = true;
                order.orderlines.each(function (line) {
                    line.set_dirty(false);
                });
                order.saved_resume = order.build_line_resume();
                order.trigger('change', order);
                order.syncing = false;
            }
            if (this.config.screen_type && (this.config.screen_type == 'kitchen' || this.config.screen_type == 'kitchen_waiter')) {
                this.trigger('save:new_transactions', computeChanges, 'kitchen');
            }
        },
        // TODO: dong bo chuyen ban, tach ban
        sync_order_transfer_new_table: function (vals) {
            var order = this.get_order_by_uid(vals.uid);
            var current_screen = this.gui.get_current_screen();
            if (order != undefined) {
                if (this.floors_by_id[vals.floor_id] && this.tables_by_id[vals.table_id]) {
                    var table = this.tables_by_id[vals.table_id];
                    var floor = this.floors_by_id[vals.floor_id];
                    if (table && floor) {
                        order.table = table;
                        order.table_id = table.id;
                        order.floor = floor;
                        order.floor_id = floor.id;
                        order.trigger('change', order);
                        if (current_screen) {
                            this.gui.show_screen(current_screen);
                        }
                        $('.order-selector').hide();
                    }
                    if (!table || !floor) {
                        order.table = null;
                        order.trigger('change', order);
                    }
                }
            }
        },
        // TODO: dong bo tong so khach hang tren ban
        sync_set_customer_count: function (vals) { // update count guest
            var order = this.get_order_by_uid(vals.uid);
            if (order) {
                order.syncing = true;
                order.set_customer_count(vals.count);
                order.trigger('change', order);
                order.syncing = false;
            }
        },
        // TODO: dong bo ghi chu cua line
        sync_set_note: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) {
                line.syncing = true;
                line.set_note(vals['note']);
                line.syncing = false;
            }
        },
        // TODO: return data for floors/tables screen
        get_count_need_print: function (table) {
            var orders = this.get('orders').models;
            var vals = {
                'active_print': 0,
                'unactive_print': 0,
            };
            var orders_current = [];
            for (var x = 0; x < orders.length; x++) {
                if (orders[x].table && orders[x].table.id == table.id) {
                    orders_current.push(orders[x])
                }
            }
            if (orders_current.length) {
                for (i in orders_current) {
                    var order = orders_current[i];
                    for (var i = 0; i < order.orderlines.models.length; i++) {
                        var line = order.orderlines.models[i];
                        if (line.mp_dirty == true) {
                            vals['active_print'] += 1;
                        } else {
                            vals['unactive_print'] += 1
                        }
                    }
                }
            }
            return vals;
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        get_lines_missed_request_kitchen: function () {
            var delivery_kitchen = false;
            this.orderlines.each(function (line) {
                if (line['state'] == 'Draft') {
                    delivery_kitchen = true;
                }
            });
            return delivery_kitchen;
        },
        get_lines_need_delivery: function () {
            var need_delivery = false;
            this.orderlines.each(function (line) {
                if (line['state'] == 'Ready') {
                    need_delivery = true
                }
            });
            return need_delivery;
        },

        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.notify_messages) {
                json.notify_messages = this.notify_messages;
            }
            return json;
        },
        initialize: function (attributes, options) {
            var self = this;
            _super_order.initialize.apply(this, arguments)
            if (!this.notify_messages) {
                this.notify_messages = {};
            }
            this.state = false;
            this.bind('change', function (order) {
                self.pos.trigger('update:floor-screen')
            });
            this.orderlines.bind('change add remove', function (line) {
                self.pos.trigger('update:floor-screen')
            })
        },
        set_customer_count: function (count) { //sync to other sessions
            var res = _super_order.set_customer_count.apply(this, arguments)
            if ((this.syncing == false || !this.syncing) && this.pos.pos_bus) {
                var order = this.export_as_JSON();
                this.pos.pos_bus.send_notification({
                    action: 'set_customer_count',
                    data: {
                        uid: this.uid,
                        count: count
                    },
                    order_uid: order['uid'],
                });
            }
            return res
        },
        reprint_last_receipt_kitchen: function () {
            if (!this.pos.printer_receipts) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Have not any last orders submit'
                });
            }
            var printers = this.pos.printers;
            for (var i = 0; i < printers.length; i++) {
                var printer = printers[i];
                var printer_id = printer.config.id;
                if (this.pos.printer_receipts[printer_id]) {
                    printer.print(this.pos.printer_receipts[printer_id]);
                }
            }
        },
        saveChanges: function () { //TODO: trigger print event sync to other sessions
            var computeChanges = this.computeChanges();
            var res = _super_order.saveChanges.apply(this, arguments);
            if ((this.syncing == false || !this.syncing) && this.pos.pos_bus && !this.pos.splitbill) {
                var order = this.export_as_JSON();
                this.pos.pos_bus.send_notification({
                    action: 'request_printer',
                    data: {
                        uid: this.uid,
                        computeChanges: computeChanges,
                    },
                    order_uid: order.uid,
                });
            }
            var orderlines = this.orderlines.models;
            for (var i = 0; i < orderlines.length; i++) {
                if (orderlines[i].state && orderlines[i].state == 'Draft') {
                    orderlines[i].set_state('Waiting');
                }
            }
            return res;
        }
    });

    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function () {
            _super_order_line.initialize.apply(this, arguments);
            if (!this.cancel_reason) {
                this.cancel_reason = '';
            }
            if (!this.creation_time) {
                this.creation_time = new Date().toLocaleTimeString();
            }
        },
        init_from_JSON: function (json) {
            if (json.state) {
                this.state = json.state
            }
            if (json.creation_time) {
                this.creation_time = json.creation_time;
            }
            if (json.qty_new) {
                this.qty_new = json.qty_new;
            }
            if (json.cancel_reason) {
                this.cancel_reason = json.cancel_reason;
            }
            if (json.creation_time) {
                this.creation_time = json.creation_time;
            }
            if (json.quantity_done) {
                this.quantity_done = json.quantity_done;
            }
            if (json.quantity_wait) {
                this.quantity_wait = json.quantity_wait;
            }
            _super_order_line.init_from_JSON.apply(this, arguments);
        },
        export_as_JSON: function () {
            var json = _super_order_line.export_as_JSON.apply(this, arguments);
            if (!this.state) {
                this.state = 'Draft';
            }
            if (this.state) {
                json.state = this.state;
            }
            if (this.cancel_reason) {
                json.cancel_reason = this.cancel_reason;
            }
            if (this.qty_new) {
                json.qty_new = this.qty_new;
            }
            if (this.creation_time) {
                json.creation_time = this.creation_time;
            }
            if (this.quantity_done) {
                json.quantity_done = this.quantity_done;
            }
            if (this.quantity_wait) {
                json.quantity_wait = this.quantity_wait;
            }
            return json;
        },
        set_state: function (state) { // TODO: waiters, cashiers push notifications to kitchen waiters and kitchen chef
            this.state = state;
            this.trigger('change', this);
            if (this.get_allow_sync()) {
                this.trigger_update_line();
                this.pos.pos_bus.send_notification({
                    action: 'set_state',
                    data: {
                        uid: this.uid,
                        state: state,
                    },
                })
            }
            this.pos.trigger('updated:line_state')
        },
        printable: function () {
            if (this.get_product()) {
                return _super_order_line.printable.apply(this, arguments)
            } else {
                return null;
            }
        },
        set_note: function (note) {
            var res = _super_order_line.set_note.apply(this, arguments);
            if ((this.syncing == false || !this.syncing) && this.pos.pos_bus) {
                var order = this.order.export_as_JSON();
                this.pos.pos_bus.send_notification({
                    action: 'set_note',
                    data: {
                        uid: this.uid,
                        note: note,
                    },
                    order_uid: order.uid,
                });
            }
            return res;
        },
        get_line_diff_hash: function () {
            var str = this.id + '|';
            if (this.get_note()) {
                str += this.get_note();
            }
            if (this.uom_id) {
                str += this.uom_id;
            }
            if (this.variants && this.variants.length) {
                for (var i = 0; i < this.variants.length; i++) {
                    var variant = this.variants[i];
                    str += variant['attribute_id'][0];
                    str += '|' + variant['value_id'][0];
                }
            }
            if (this.tags && this.tags.length) {
                for (var i = 0; i < this.tags.length; i++) {
                    var tag = this.tags[i];
                    str += '|' + tag['id'];
                }
            }
            if (this.combo_items && this.combo_items.length) {
                for (var i = 0; i < this.combo_items.length; i++) {
                    var combo = this.combo_items[i];
                    str += '|' + combo['id'];
                }
            }
            return str
        },
    });

    sync.pos_bus = sync.pos_bus.extend({
        set_state: function (uid, state, values) { // TODO: method push state direct kitchen to cashier
            this.pos.pos_bus.send_notification({
                action: 'set_state',
                data: {
                    uid: uid,
                    state: state,
                    values: values
                },
            })
        }
    });

    _super_order.computeChanges = function (categories) {
        var d = new Date();
        var hours = '' + d.getHours();
        hours = hours.length < 2 ? ('0' + hours) : hours;
        var minutes = '' + d.getMinutes();
        minutes = minutes.length < 2 ? ('0' + minutes) : minutes;
        var current_res = this.build_line_resume();
        var old_res = this.saved_resume || {};
        var json = this.export_as_JSON();
        var add = [];
        var rem = [];
        var line_hash;
        for (line_hash in current_res) {
            var curr = current_res[line_hash];
            var old = old_res[line_hash];
            var product = this.pos.db.get_product_by_id(curr.product_id);
            var pos_categ_id = product.pos_categ_id;
            if (pos_categ_id.length) {
                pos_categ_id = pos_categ_id[1]
            }
            if (typeof old === 'undefined') {
                add.push({
                    'sequence_number': this.sequence_number,
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': curr.qty,
                    'uom': curr.uom,
                    'variants': curr.variants,
                    'tags': curr.tags,
                    'combo_items': curr.combo_items,
                    'state': curr.state,
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            } else if (old.qty < curr.qty) {
                add.push({
                    'sequence_number': this.sequence_number,
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': curr.qty - old.qty,
                    'uom': curr.uom,
                    'variants': curr.variants,
                    'tags': curr.tags,
                    'combo_items': curr.combo_items,
                    'state': curr.state,
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            } else if (old.qty > curr.qty) {
                rem.push({
                    'sequence_number': this.sequence_number,
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': old.qty - curr.qty,
                    'uom': curr.uom,
                    'variants': curr.variants,
                    'tags': curr.tags,
                    'combo_items': curr.combo_items,
                    'state': 'Cancelled',
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            }
        }

        for (line_hash in old_res) {
            if (typeof current_res[line_hash] === 'undefined') {
                var old = old_res[line_hash];
                var product = this.pos.db.get_product_by_id(old.product_id);
                var pos_categ_id = product.pos_categ_id;
                if (pos_categ_id.length) {
                    pos_categ_id = pos_categ_id[1]
                }
                rem.push({
                    'sequence_number': this.sequence_number,
                    'order_uid': json.uid,
                    'id': old.product_id,
                    'uid': old.uid,
                    'name': this.pos.db.get_product_by_id(old.product_id).display_name,
                    'name_wrapped': old.product_name_wrapped,
                    'note': old.note,
                    'qty': old.qty,
                    'uom': old.uom,
                    'variants': old.variants,
                    'tags': old.tags,
                    'combo_items': old.combo_items,
                    'state': 'Cancelled',
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            }
        }

        if (categories && categories.length > 0) {
            // filter the added and removed orders to only contains
            // products that belong to one of the categories supplied as a parameter

            var self = this;

            var _add = [];
            var _rem = [];

            for (var i = 0; i < add.length; i++) {
                if (self.pos.db.is_product_in_category(categories, add[i].id)) {
                    _add.push(add[i]);
                }
            }
            add = _add;

            for (var i = 0; i < rem.length; i++) {
                if (self.pos.db.is_product_in_category(categories, rem[i].id)) {
                    _rem.push(rem[i]);
                }
            }
            rem = _rem;
        }
        return {
            'guest_number': json['guest_number'],
            'guest': json['guest'],
            'note': json['note'],
            'uid': json['uid'],
            'sequence_number': json['sequence_number'],
            'new': add,
            'cancelled': rem,
            'table': json.table || false,
            'floor': json.floor || false,
            'name': json.name || 'unknown order',
            'time': {
                'hours': hours,
                'minutes': minutes,
            },
        };
    };
    _super_order.build_line_resume = function () {
        var resume = {};
        var self = this;
        this.orderlines.each(function (line) {
            if (line.mp_skip) {
                return;
            }
            var line_hash = line.get_line_diff_hash();
            var qty = Number(line.get_quantity());
            var note = line.get_note();
            var product_id = line.get_product().id;
            var product = self.pos.db.get_product_by_id(product_id);
            var pos_categ_id = product.pos_categ_id;
            if (pos_categ_id.length) {
                pos_categ_id = pos_categ_id[1]
            }
            if (typeof resume[line_hash] === 'undefined') {
                resume[line_hash] = {
                    sequence_number: this.sequence_number,
                    uid: line.uid,
                    qty: qty,
                    note: note,
                    product_id: product_id,
                    product_name_wrapped: line.generate_wrapped_product_name(),
                    uom: [],
                    variants: [],
                    tags: [],
                    combo_items: [],
                    category: pos_categ_id,
                    state: line.state
                };
                if (line['variants']) {
                    resume[line_hash]['variants'] = line['variants'];
                }
                if (line['tags']) {
                    resume[line_hash]['tags'] = line['tags'];
                }
                if (line.uom_id) {
                    resume[line_hash]['uom'] = self.pos.uom_by_id[line.uom_id]
                }
                if (line.product.uom_id && !line.uom_id) {
                    resume[line_hash]['uom'] = self.pos.uom_by_id[line.product.uom_id[0]]
                }
                if (line.combo_items && line.combo_items.length) {
                    resume[line_hash]['combo_items'] = line['combo_items']
                }
            } else {
                resume[line_hash].qty += qty;
            }
        });
        return resume;
    };
});