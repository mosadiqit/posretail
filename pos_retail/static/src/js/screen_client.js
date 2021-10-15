"use strict";
odoo.define('pos_retail.screen_client_list', function (require) {
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;
    var rpc = require('pos.rpc');
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var QWeb = core.qweb;
    var _t = core._t;

    var popup_create_customer = PopupWidget.extend({
        template: 'popup_create_customer',
        show: function (options) {
            var self = this;
            this.uploaded_picture = null;
            this._super(options);
            this.$('.datepicker').datetimepicker({
                format: 'DD-MM-YYYY',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            var contents = this.$('.create_partner');
            contents.scrollTop(0);
            this.$('.confirm').click(function () {
                var fields = {};
                $('.partner_input').each(function (idx, el) {
                    fields[el.name] = el.value || false;
                });
                if (!fields.name) {
                    return self.wrong_input('input[name="name"]', '(*) Field Name is required');
                } else {
                    self.passed_input('input[name="name"]');
                }
                if (fields['phone']) {
                    var is_phone = self.check_is_number(fields['phone']);
                    if (!is_phone) {
                        return self.wrong_input('input[name="phone"]', '(*) Field Phone is not number [0-9]');
                    }
                } else {
                    self.passed_input('input[name="phone"]');
                }
                if (fields['mobile']) {
                    var is_mobile = self.check_is_number(fields['mobile']);
                    if (!is_mobile) {
                        return self.wrong_input('input[name="mobile"]', '(*) Field Mobile is not number [0-9]');
                    }
                } else {
                    self.passed_input('input[name="mobile"]');
                }
                if (self.pos.config.check_duplicate_email && fields['email']) {
                    var is_duplicate = self._check_is_duplicate(fields['email'], 'email');
                    if (is_duplicate) {
                        return self.wrong_input('input[name="email"]', '(*) Field email used by another client');
                    }
                } else {
                    self.passed_input('input[name="email"]');
                }
                if (self.pos.config.check_duplicate_phone && fields['phone']) {
                    var is_duplicate = self._check_is_duplicate(fields['phone'], 'phone');
                    if (is_duplicate) {
                        return self.wrong_input('input[name="phone"]', '(*) Field phone used by another client');
                    }
                } else {
                    self.passed_input('input[name="phone"]');
                }
                if (self.pos.config.check_duplicate_phone && fields['mobile']) {
                    var is_duplicate = self._check_is_duplicate(fields['mobile'], 'mobile');
                    if (is_duplicate) {
                        return self.wrong_input('input[name="mobile"]', '(*) Field mobile used by another client');
                    }
                } else {
                    self.passed_input('input[name="mobile"]');
                }
                if (self.uploaded_picture) {
                    fields.image = self.uploaded_picture.split(',')[1];
                }
                fields['customer'] = true;
                if (fields['property_product_pricelist']) {
                    fields['property_product_pricelist'] = parseInt(fields['property_product_pricelist'])
                }
                if (self.pos.config.pos_branch_id) {
                    fields['pos_branch_id'] = self.pos.config.pos_branch_id[0]
                }
                self.pos.gui.close_popup();
                return rpc.query({
                    model: 'res.partner',
                    method: 'create_from_ui',
                    args: [fields]
                }).then(function (partner_id) {
                    var pushing = self.pos._search_read_by_model_and_id('res.partner', [partner_id])
                    pushing.done(function (datas) {
                        if (datas.length == 0) {
                            return;
                        }
                        self.pos.sync_with_backend('res.partner', datas, true);
                        var partner_id = datas[0]['id'];
                        var client = self.pos.db.get_partner_by_id(partner_id);
                        var order = self.pos.get_order();
                        if (client && order) {
                            order.set_client(client);
                            self.pos.gui.show_popup('dialog', {
                                title: 'Great job',
                                body: 'Set ' + client['name'] + ' to current order',
                                color: 'success'
                            })
                        }
                    })
                }, function (err) {
                    self.pos.query_backend_fail(err);
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
    gui.define_popup({name: 'popup_create_customer', widget: popup_create_customer});

    screens.ClientListScreenWidget.include({
        init: function (parent, options) {
            this._super(parent, options);
            var self = this;
            this.pos.bind('client:save_changes', function () {
                self.save_changes();
            });
        },
        refresh_screen: function () {
            var self = this;
            this.pos.get_modifiers_backend_all_models().done(function () {
                self.pos.trigger('refresh:partner_screen');
            });
        },
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('refresh:partner_screen', function () {
                var partners = self.pos.db.get_partners_sorted(100);
                self.re_render_list(partners);
            });
        },
        re_render_list: function (partners) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(partners.length, 1000); i < len; i++) {
                var partner = partners[i];
                if (!partner) {
                    continue
                }
                var clientline_html = qweb.render('ClientLine', {widget: this, partner: partner});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                this.partner_cache.cache_node(partner.id, clientline);
                if (partner === this.old_client) {
                    clientline.classList.add('highlight');
                } else {
                    clientline.classList.remove('highlight');
                }
                contents.appendChild(clientline);
            }
        },
        display_client_details: function (visibility, partner, clickpos) { // TODO: we add input type date to box birth day of client edit
            var self = this;
            if (partner) {
                var orders = this.pos.db.get_pos_orders().filter(function (order) {
                    return order.partner_id && order.partner_id[0] == partner['id']
                });
                partner.orders_count = orders.length;
            }
            this._super(visibility, partner, clickpos);
            this.$("input[name='birthday_date']").datetimepicker({
                format: 'DD-MM-YYYY',
                calendarWeeks: true,
                icons: {
                    time: 'fa fa-clock-o',
                    date: 'fa fa-calendar',
                    next: 'fa fa-chevron-right',
                    previous: 'fa fa-chevron-left',
                    up: 'fa fa-chevron-up',
                    down: 'fa fa-chevron-down',
                    close: 'fa fa-times',
                },
                // locale: moment.locale(),
            });
            if (visibility == 'show' && partner) {
                this.el.querySelector('.purchased-histories').addEventListener('click', function (event) {
                    self.pos.show_purchased_histories(partner);
                })
            }
            var contents = this.$('.client-details-contents');
            contents.off('click', '.print_card');
            contents.on('click', '.print_card', function () {
                self.print_client_card(partner);
            });
        },
        image_by_group_url: function (id) {
            return '/web/image?model=res.partner.group&id=' + id + '&field=image';
        },
        print_client_card: function (partner) {
            var self = this;
            var list = [];
            for (var i = 0; i < partner.group_ids.length; i++) {
                var group_id = partner.group_ids[i];
                var group = this.pos.membership_group_by_id[group_id];
                if (group) {
                    list.push({
                        'label': group.name,
                        'item': group
                    });
                }
            }
            if (list.length == 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your POS config not add any membership/group. Please go to POS Config / Clients Screen Tab and config again'
                })
            }
            this.gui.show_popup('selection', {
                title: _t('Select one Group'),
                list: list,
                confirm: function (group) {
                    var vals = {
                        widget: self,
                        partner: partner,
                        group: group,
                        image: 'data:image/png;base64,' + group.image,
                    };
                    self.pos.report_html = QWeb.render('membership_card_html', vals);
                    // self.pos.report_xml = QWeb.render('membership_card_xml', vals);
                    self.gui.show_screen('report');
                    self.$('img[id="barcode"]').removeClass('oe_hidden');
                    JsBarcode("#barcode", partner['barcode'], {
                        format: "EAN13",
                        displayValue: true,
                        fontSize: 14
                    });
                }
            });

        },
        show: function () {
            var self = this;
            this.search_partners = [];
            this._super();
            this.refresh_screen();
            var $search_box = $('.clientlist-screen .searchbox >input');
            $search_box.autocomplete({
                source: this.pos.db.get_partners_source(),
                minLength: this.pos.config.min_length_search,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                        if (partner) {
                            self.pos.get_order().set_client(partner);
                            self.pos.gui.back();
                        }
                        setTimeout(function () {
                            self.clear_search()
                        }, 2000);

                    }
                }
            });
            this.$('.only_customer').click(function () {
                self.pos.only_customer = !self.pos.only_customer;
                self.pos.only_supplier = !self.pos.only_customer;
                if (self.pos.only_customer) {
                    self.$('.only_customer').addClass('highlight');
                    self.$('.only_supplier').removeClass('highlight');
                } else {
                    self.$('.only_customer').removeClass('highlight');
                    self.$('.only_supplier').addClass('highlight');
                }
                var partners = self._get_partners();
                self.render_list(partners);
            });
            this.$('.only_supplier').click(function () {
                self.pos.only_supplier = !self.pos.only_supplier;
                self.pos.only_customer = !self.pos.only_supplier;
                if (self.pos.only_supplier) {
                    self.$('.only_supplier').addClass('highlight');
                    self.$('.only_customer').removeClass('highlight');
                } else {
                    self.$('.only_supplier').removeClass('highlight');
                    self.$('.only_customer').addClass('highlight');
                }
                var partners = self._get_partners();
                self.render_list(partners);
            });
            this.$('.back').click(function () {
                self.pos.trigger('back:order');
            });
            this.$('.next').click(function () {
                self.pos.trigger('back:order');
            });
            this.$('.sort_by_id').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('id', self.reverse, parseInt));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('id', self.reverse, parseInt));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_name').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_address').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_phone').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('phone', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('phone', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_mobile').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('mobile', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('mobile', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
        },
        _get_partners: function () {
            if (this.partners_list) {
                return this.partners_list
            } else {
                return this.pos.db.get_partners_sorted(1000)
            }
        },
        render_list: function (partners) {
            if (this.pos.only_customer) {
                var partners = _.filter(partners, function (partner) {
                    return partner['customer'] == true;
                });
                return this._super(partners);
            }
            if (this.pos.only_supplier) {
                var partners = _.filter(partners, function (partner) {
                    return partner['supplier'] == true;
                });
                return this._super(partners);
            }
            this.partners_list = partners;
            return this._super(partners);
        },
        clear_search: function () {
            return this._super();
        },
        save_client_details: function (partner) {
            var id = partner.id || false;
            var fields = {};
            this.$('.client-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['name']) {
                return this.wrong_input('input[name="name"]', '(*) Field name is required');
            } else {
                this.passed_input('input[name="name"]');
            }
            if (fields['phone']) {
                var is_phone = this.check_is_number(fields['phone']);
                if (!is_phone) {
                    return this.wrong_input('input[name="phone"]', '(*) Field phone is not a number');
                }
            } else {
                this.passed_input('input[name="phone"]');
            }
            if (fields['mobile']) {
                var is_mobile = this.check_is_number(fields['mobile']);
                if (!is_mobile) {
                    return this.wrong_input('input[name="mobile"]', '(*) Field mobile is not a number');
                }
            } else {
                this.passed_input('input[name="mobile"]');
            }
            if (this.pos.config.check_duplicate_email && fields['email']) {
                var is_duplicated = this._check_is_duplicate(fields['email'], 'email', id);
                if (is_duplicated) {
                    return this.wrong_input('input[name="email"]', '(*) Field email is unique, this email used another client');
                } else {
                    this.passed_input('input[name="email"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['phone']) {
                var is_duplicated = this._check_is_duplicate(fields['phone'], 'phone', id);
                if (is_duplicated) {
                    return this.wrong_input('input[name="phone"]', '(*) Field phone is unique, this phone used another client');
                } else {
                    this.passed_input('input[name="phone"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['mobile']) {
                var is_duplicated = this._check_is_duplicate(fields['mobile'], 'mobile', id);
                if (is_duplicated) {
                    return this.wrong_input('input[name="mobile"]', '(*) Field mobile is unique, this mobile used another client');
                } else {
                    this.passed_input('input[name="mobile"]');
                }
            }
            return this._super(partner);
        },
        saved_client_details: function (partner_id) {
            var self = this;
            this.reload_partners(partner_id).then(function () {
                var partner = self.pos.db.get_partner_by_id(partner_id);
                if (partner) {
                    self.new_client = partner;
                    self.toggle_save_button();
                    self.display_client_details('show', partner);
                } else {
                    // should never happen, because create_from_ui must return the id of the partner it
                    // has created, and reload_partner() must have loaded the newly created partner.
                    self.display_client_details('hide');
                }
            }).always(function () {
                $(".client-details-contents").on('click', '.button.save', function () {
                    if (self.new_client) {
                        self.save_client_details(self.new_client);
                    }
                });
            });
            // merge to 13
            if (partner_id && this.pos.config.pos_branch_id) {
                rpc.query({
                    model: 'res.partner',
                    method: 'update_branch_to_partner',
                    args: [[partner_id], {'pos_branch_id': this.pos.config.pos_branch_id[0]}],
                }).then(function (result) {
                    console.log('update branch to partner success')
                }).fail(function (error) {
                    return self.pos.query_backend_fail(error);
                });
            }
        },
        reload_partners: function (partner_id) {
            var self = this;
            return this.pos.load_new_partners(partner_id).then(function () {
                self.partner_cache = new screens.DomCache();
                self.render_list(self._get_partners());
                var curr_client = self.pos.get_order().get_client();
                if (curr_client) {
                    self.pos.get_order().set_client(self.pos.db.get_partner_by_id(curr_client.id));
                }
            });
        },
    });

    models.PosModel = models.PosModel.extend({
        load_new_partners: function (partner_id) {
            // TODO 1: we force method odoo because we only need load new partner with partner_id, not check write_date
            // TODO 2: so if you need reuse, you call can this method without partner_id
            var self = this;
            var def = new $.Deferred();
            var fields = _.find(this.models, function (model) {
                return model.model === 'res.partner';
            }).fields;
            if (partner_id) {
                var domain = [['id', '=', partner_id]];
            } else {
                var domain = [['customer', '=', true], ['write_date', '>', this.db.get_partner_write_date()]];
            }
            rpc.query({
                model: 'res.partner',
                method: 'search_read',
                args: [domain, fields],
            }, {
                timeout: 3000,
                shadow: true,
            })
                .then(function (partners) {
                    for (var i = 0; i < partners.length; i++) {
                        var partner = partners[i];
                        if (partner['birthday_date']) {
                            partner['birthday_date'] = self.db._format_date(partner['birthday_date'])
                        }
                    }
                    if (self.db.add_partners(partners)) {   // check if the partners we got were real updates
                        def.resolve();
                    } else {
                        def.reject();
                    }
                }, function (err) {
                    def.reject(err);
                });
            return def;
        },

    })
});
