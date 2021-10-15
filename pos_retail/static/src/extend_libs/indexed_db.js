odoo.define('pos_retail.indexedDB', function (require) {
    "use strict";

    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
    if (!indexedDB) {
        window.alert("Your browser doesn't support a stable version of IndexedDB.")
    }
    var multi_database = {
        init: function (table_name, sequence) {
            var self = this;
            var status = new $.Deferred();
            this.pos = this.pos || self.posmodel;
            var request = indexedDB.open(this.pos.session.db + '_' + sequence, 1);
            request.onerror = function (ev) {
                status.reject(ev);
            };
            request.onupgradeneeded = function (ev) {
                var db = ev.target.result;
                try {
                    var os_product = db.createObjectStore('product.product', {keyPath: "id"});
                    os_product.createIndex('bc_index', 'barcode', {unique: false})
                    os_product.createIndex('dc_index', 'default_code', {unique: false});
                    os_product.createIndex('name_index', 'name', {unique: false});
                    var os_partner = db.createObjectStore('res.partner', {keyPath: "id"});
                    os_partner.createIndex('name_index', 'name', {unique: false});
                    os_partner.createIndex('mobile_index', 'mobile', {unique: false});
                    os_partner.createIndex('phone_index', 'phone', {unique: false});
                    os_partner.createIndex('barcode_index', 'barcode', {unique: false});
                } catch (e) {
                    console.error(e);
                }
            };
            request.onsuccess = function (ev) {
                var db = ev.target.result;
                try {
                    var transaction = db.transaction([table_name], "readwrite");
                    transaction.oncomplete = function () {
                        db.close();
                    };
                    if (!transaction) {
                        status.reject(new Error('Cannot create transaction with ' + table_name));
                    }
                    var store = transaction.objectStore(table_name);
                    if (!store) {
                        status.reject(new Error('Cannot get object store with ' + table_name));
                    }
                    status.resolve(store);
                } catch (e) {
                    console.error(e);
                    self.pos.remove_indexed_db();
                    self.pos.reload_pos();
                }

            };
            return status.promise();
        },
        write: function (table_name, items) {
            console.log('updating table ' + table_name + ' with total rows ' + items.length);
            var max_id = items[items.length - 1]['id'];
            var sequence = Math.floor(max_id / 100000);
            var request = indexedDB.open(this.pos.session.db + '_' + sequence, 1);
            request.onsuccess = function (ev) {
                var db = ev.target.result;
                var transaction = db.transaction([table_name], "readwrite");
                transaction.oncomplete = function () {
                    db.close();
                };
                if (!transaction) {
                    return;
                }
                var store = transaction.objectStore(table_name);
                if (!store) {
                    return;
                }
                _.each(items, function (item) {
                    var status = store.put(item);
                    status.onerror = function (e) {
                        console.error(e)
                    };
                    status.onsuccess = function (ev) {
                    };
                });
            };
        },
        unlink: function (table_name, item) {
            console.error('deleted id ' + item['id'] + ' of table ' + table_name);
            var sequence = Math.floor(item['id'] / 100000);
            $.when(this.init(table_name, sequence)).done(function (store) {
                try {
                    store.delete(item.id).onerror = function (e) {
                        console.error(e);
                    };
                } catch (e) {
                    console.error(e);
                }
            })
        },
        search_by_index: function (table_name, max_sequence, index_list, value) {
            var status = new $.Deferred();
            var self = this;

            function load_data(sequence) {
                if (sequence < max_sequence) {
                    $.when(self.init(table_name, sequence)).done(function (object_store) {
                        for (var i = 0; i < index_list.length; i++) {
                            var index = index_list[i];
                            var idb_index = object_store.index(index);
                            var request = idb_index.get(value);
                            request.onsuccess = function (ev) {
                                var item = ev.target.result || {};
                                if (item['id']) {
                                    status.resolve(item);
                                }
                            };
                            request.onerror = function (error) {
                                console.error(error);
                                status.reject(error);
                            };
                        }
                    }).fail(function (error) {
                        status.reject(error);
                    }).done(function () {
                        sequence += 1;
                        load_data(sequence);
                    });
                }
            }

            load_data(0);
            return status.promise();
        },
        search_read: function (table_name, sequence) {
            var status = new $.Deferred();
            $.when(this.init(table_name, sequence)).done(function (store) {
                var request = store.getAll();
                request.onsuccess = function (ev) {
                    var items = ev.target.result || [];
                    status.resolve(items);
                };
                request.onerror = function (error) {
                    status.reject(error);
                };
            }).fail(function (error) {
                status.reject(error);
            });
            return status.promise();
        },
        get_products: function (pos, max_sequence) {
            this.pos = pos;
            var self = this;
            var status = new $.Deferred();

            function load_data(sequence) {
                if (sequence < max_sequence) {
                    $.when(self.search_read('product.product', sequence)).then(function (products) {
                        if (products.length > 0) {
                            self.pos.save_results('product.product', products);
                        }
                        if (self.pos.total_products >= 1000000) {
                            sequence = max_sequence;
                            status.resolve();
                        }
                    }).done(function () {
                        sequence += 1;
                        load_data(sequence);
                    });
                } else {
                    status.resolve();
                }
            }

            load_data(0);
            return status.promise();
        },
        get_clients: function (pos, max_sequence) {
            this.pos = pos;
            var self = this;
            var done = new $.Deferred();

            function load_data(sequence) {
                if (sequence > max_sequence) {
                    done.resolve();
                } else {
                    $.when(self.search_read('res.partner', sequence)).then(function (results) {
                        if (results.length > 0) {
                            self.pos.save_results('res.partner', results);
                        }
                        if (self.pos.total_clients >= 1000000) {
                            sequence = max_sequence;
                            status.resolve();
                        }
                    }).done(function () {
                        sequence += 1;
                        load_data(sequence);
                    });
                }
            }

            load_data(0);
            return done.promise();
        }
    };

    return multi_database;
});
