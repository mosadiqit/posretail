"use strict";
odoo.define('pos_retail.screen_products_operation', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var PopupWidget = require('point_of_sale.popups');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    var popup_create_pos_category = PopupWidget.extend({
        template: 'popup_create_pos_category',
        show: function (options) {
            var self = this;
            this.uploaded_picture = null;
            this._super(options);
            var contents = this.$('.create_product');
            contents.scrollTop(0);
            this.$('.confirm').click(function () {
                var fields = {};
                var validate;
                $('.category_input').each(function (idx, el) {
                    fields[el.name] = el.value || false;
                });
                if (!fields.name) {
                    self.wrong_input('input[name="name"]', "(*) Name is required");
                    validate = false;
                } else {
                    self.passed_input('input[name="name"]');
                }
                if (validate == false) {
                    return;
                }
                if (this.uploaded_picture) {
                    fields.image = this.uploaded_picture.split(',')[1];
                }
                if (fields['parent_id']) {
                    fields['parent_id'] = parseInt(fields['parent_id'])
                }
                return rpc.query({
                    model: 'pos.category',
                    method: 'create',
                    args: [fields]
                }).then(function (category_id) {
                    rpc.query({
                        model: 'pos.category',
                        method: 'search_read',
                        args: [[['id', '=', category_id]]],
                    }).then(function (categories) {
                        var pos_categ_model = self.pos.get_model('pos.category');
                        pos_categ_model.loaded(self.pos, categories, {});
                        self.pos.trigger('reload:product-categories-screen');
                    });
                    console.log('{category_id} created : ' + category_id);
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Great job !',
                        body: '1 new category just added to your pos screen',
                        color: 'success'
                    });
                }, function (err) {
                    if (err.code && err.code == 200 && err.data && err.data.message && err.data.name) {
                        self.pos.gui.show_popup('dialog', {
                            title: err.data.name,
                            body: err.data.message,
                        })
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    }
                });
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        load_image_file: function (file, callback) {
            var self = this;
            if (!file) {
                return;
            }
            if (file.type && !file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                });
            }

            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 600, 400, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                });
            };
            reader.readAsDataURL(file);
        },
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        }
    });
    gui.define_popup({name: 'popup_create_pos_category', widget: popup_create_pos_category});

    var popup_create_product = PopupWidget.extend({
        template: 'popup_create_product',
        show: function (options) {
            var self = this;
            this.uploaded_picture = null;
            this._super(options);
            var contents = this.$('.create_product');
            contents.scrollTop(0);
            this.$('.confirm').click(function () {
                var fields = {};
                $('.product_input').each(function (idx, el) {
                    fields[el.name] = el.value || false;
                });
                if (!fields.name) {
                    return self.wrong_input('input[name="name"]', "(*) Name is required");
                } else {
                    self.passed_input('input[name="name"]');
                }
                if (this.uploaded_picture) {
                    fields.image = this.uploaded_picture.split(',')[1];
                }
                if (fields['pos_categ_id']) {
                    fields['pos_categ_id'] = parseInt(fields['pos_categ_id'])
                }
                fields['available_in_pos'] = true;
                self.gui.close_popup();
                return rpc.query({
                    model: 'product.product',
                    method: 'create',
                    args: [fields]
                }).then(function (product_id) {
                    console.log('{product_id} created : ' + product_id);
                    self.pos.get_modifiers_backend('product.product');
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Good job !',
                        body: '1 Product just added to your pos screen',
                        color: 'success'
                    })
                }, function (err) {
                    if (err.code && err.code == 200 && err.data && err.data.message && err.data.name) {
                        self.pos.gui.show_popup('dialog', {
                            title: err.data.name,
                            body: err.data.message
                        })
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    }
                });
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        load_image_file: function (file, callback) {
            var self = this;
            if (!file) {
                return;
            }
            if (file.type && !file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                });
            }

            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 600, 400, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                });
            };
            reader.readAsDataURL(file);
        },
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        }
    });
    gui.define_popup({name: 'popup_create_product', widget: popup_create_product});

    var products_operation = screens.ScreenWidget.extend({ // products screen
        template: 'products_operation',
        init: function (parent, options) {
            this.product_selected = null;
            this._super(parent, options);
        },
        refresh_screen: function () {
            var products = this.pos.db.get_products(1000);
            var results = [];
            products.forEach(function (item) {
                if (results.indexOf(item) < 0) {
                    results.push(item);
                }
            });
            this.render_list(results);
            if (this.product_selected) {
                var product = this.pos.db.product_by_id[this.product_selected['id']];
                if (product) {
                    this.display_product_edit('show', product, 0);
                }
            }
        },
        apply_quickly_search_products: function () {
            var self = this;
            var $order_screen_find_product_box = this.$('.searchbox >input');
            $order_screen_find_product_box.autocomplete({
                source: this.pos.db.get_products_source(),
                minLength: this.pos.config.min_length_search,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                        if (product) {
                            self.display_product_edit('show', product, 0);
                        }
                        setTimeout(function () {
                            self.$('.searchbox input')[0].value = '';
                            self.$('.searchbox input').focus();
                        }, 2000);

                    }
                }
            });
        },
        show: function () {
            var self = this;
            this._super();
            this.apply_quickly_search_products();
            this.render_list();
            this.$('.back').click(function () {
                self.gui.back();
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.new-product').click(function () {
                self.display_product_edit('show', {});
            });
            if (this.product_selected) {
                this.display_product_edit('show', this.product_selected, 0);
            }
            this.$('.client-list-contents').delegate('.product_row', 'click', function (event) {
                self.select_product(event, $(this), parseInt($(this).data('id')));
            });
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-product').click(function () {
                self.clear_search();
            });
            this.$('.add_pos_category').click(function () { // quickly add product
                self.pos.gui.show_popup('popup_create_pos_category', {
                    title: 'Add New Product Category'
                })
            });
            this.$('.sort_by_product_operation_id').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('id', self.reverse, parseInt));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_default_code').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('default_code', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_barcode').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('barcode', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_display_name').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('display_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_list_price').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('list_price', self.reverse, parseInt));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_type').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('type', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_qty_available').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('qty_available', self.reverse, parseInt));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_product_operation_pos_categ_id').click(function () {
                var products = self.pos.db.get_product_by_category(0).sort(self.pos.sort_by('pos_categ', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(products);
                self.reverse = !self.reverse;
            });
        },
        hide: function () {
            this._super();
        },
        perform_search: function (query, associate_result) {
            var products = this.pos.db.search_product_in_category(0, query);
            var results = [];
            products.forEach(function (item) {
                if (results.indexOf(item) < 0) {
                    results.push(item);
                }
            });
            if (results.length) {
                this.render_list(results);
            }
        },
        clear_search: function () {
            this.render_list(this.pos.db.get_product_by_category(0));
            var $input_search = this.$('.search-product input');
            if ($input_search.length) {
                this.$('.search-product input')[0].value = '';
            }
            this.display_product_edit('hide', null);
        },
        render_list: function (products) {
            if (!products) {
                products = this.pos.db.get_product_by_category(0);
            }
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(products.length, 1000); i < len; i++) {
                var product = products[i];
                var product_line_html = qweb.render('product_row', {widget: this, product: products[i]});
                var product_line = document.createElement('tbody');
                product_line.innerHTML = product_line_html;
                product_line = product_line.childNodes[1];
                if (product === this.product_selected) {
                    product_line.classList.add('highlight');
                } else {
                    product_line.classList.remove('highlight');
                }
                contents.appendChild(product_line);
            }
        },
        select_product: function (event, $line, id) {
            var product = this.pos.db.get_product_by_id(id);
            if ($line.hasClass('highlight')) {
                $line.removeClass('highlight');
                this.display_product_edit('hide', product);
            } else {
                this.$('.client-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                var y = event.pageY - $line.parent().offset().top;
                this.display_product_edit('show', product, y);
            }
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        save_product_edit: function (product) {
            var self = this;
            var fields = {};
            this.$('.product-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields.name) {
                return this.wrong_input("input[name='name']", '(*) Name is required');
            }
            if (this.uploaded_picture) {
                fields.image = this.uploaded_picture.split(',')[1];
            }
            fields['list_price'] = parseFloat(fields['list_price']);
            fields['pos_categ_id'] = parseFloat(fields['pos_categ_id']);
            if (fields['id']) {
                rpc.query({
                    model: 'product.product',
                    method: 'write',
                    args: [[parseInt(fields['id'])], fields],
                })
                    .then(function (result) {
                        self.pos.get_modifiers_backend('product.product').done(function () {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Saved',
                                body: 'Product saved',
                                color: 'success'
                            });
                        })
                    }, function (err) {
                        self.pos.query_backend_fail(err);
                    });
            } else {
                rpc.query({
                    model: 'product.product',
                    method: 'create',
                    args: [fields],
                })
                    .then(function (product_id) {
                        self.product_new_id = product_id;
                        self.$('.product-details-contents').hide();
                        self.pos.get_modifiers_backend('product.product').done(function () {
                            var product_new_id = self.product_new_id;
                            var product = self.pos.db.product_by_id[product_new_id];
                            if (product) {
                                self.product_selected = product;
                                self.display_product_edit('show', product, 0);
                            }
                            self.pos.gui.show_popup('dialog', {
                                title: 'Saved',
                                body: 'Product saved',
                                color: 'success'
                            });
                        })
                    }, function (err) {
                        self.pos.query_backend_fail(err);
                    });
            }
        },
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        },
        load_image_file: function (file, callback) {
            var self = this;
            if (!file) {
                return;
            }
            if (file.type && !file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                });
            }
            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 600, 400, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                });
            };
            reader.readAsDataURL(file);
        },
        display_product_edit: function (visibility, product, clickpos) { // display product details to header page
            var self = this;
            var contents = this.$('.product-details-contents');
            contents.empty();
            this.product_selected = product;
            if (visibility == 'show') {
                contents.append($(qweb.render('product_edit', {widget: this, product: product})));
                contents.find('.save').on('click', function (event) {
                    self.save_product_edit(event);
                });
                contents.find('.print_label').on('click', function (event) {
                    var fields = {};
                    self.$('.product-details-contents .detail').each(function (idx, el) {
                        fields[el.name] = el.value || false;
                    });
                    var product_id = fields['id'];
                    var product = self.pos.db.product_by_id[product_id];
                    if (product && product['barcode']) {
                        var product_label_html = qweb.render('product_label_xml', {
                            product: product
                        });
                        if (self.pos.epson_printer_default) {
                            return self.pos.print_network(product_label_html, self.pos.epson_printer_default['ip']);
                        }
                        if (!self.pos.config.iface_print_via_proxy) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Your printer turn off, Please setup posbox ip address and printer'
                            })
                        }
                        self.pos.proxy.print_receipt(product_label_html);
                        self.pos.gui.show_popup('dialog', {
                            title: 'Printed barcode',
                            body: 'Please get product label at your printer',
                            color: 'success'
                        })
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Barcode product not set'
                        })
                    }
                });
                contents.find('.update_qty_on_hand').on('click', function (event) {
                    return self.pos.update_onhand_by_product(self.product_selected)
                });
                this.$('.product-details-contents').show();
            }
            if (visibility == 'hide') {
                this.$('.product-details-contents').hide();
            }
            contents.find('input').blur(function () {
                setTimeout(function () {
                    self.$('.window').scrollTop(0);
                }, 0);
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        close: function () {
            this._super();
        }
    });
    gui.define_screen({name: 'products_operation', widget: products_operation});

});
