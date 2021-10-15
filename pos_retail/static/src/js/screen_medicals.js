"use strict";
odoo.define('pos_retail.screen_medicals', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    var medical_insurance_screen = screens.ScreenWidget.extend({ // products screen
        template: 'medical_insurance_screen',
        start: function () {
            this._super();
            this.old_insurance = null;
        },
        init: function (parent, options) {
            this._super(parent, options);
            this.insurances_cache = new screens.DomCache();
        },
        show: function () {
            this.insurance_companies = _.filter(this.pos.db.partners, function (partner) {
                return partner['is_company'] == true;
            });
            var search_timeout = null;
            var self = this;
            this.renderElement();
            this.old_insurance = this.pos.get_order().medical_insurance;
            this._super();
            var $search_box = this.$('.clientlist-screen .searchbox >input');
            $search_box.autocomplete({
                source: this.pos.db.insurances_autocomplete,
                minLength: this.pos.config.min_length_search,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var insurance = self.pos.db.insurance_by_id[ui['item']['value']];
                        if (insurance) {
                            self.display_insurance('show', insurance);
                        }
                        self.clear_search();
                    }
                }
            });
            this.$('.back').click(function () {
                self.gui.back();
            });
            this.$('.new_medical').click(function () {
                self.display_insurance('show', null);
            });
            if (this.old_insurance) {
                this.display_insurance('show', this.old_insurance);
            }
            this.$('.medical_insurances').delegate('.medical_insurance', 'click', function (event) {
                self.insurance_selected(event, $(this), parseInt($(this).data('id')));
            });
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
            this.$('.search-clear').click(function () {
                self.clear_search();
            });
            this.render_list(this.pos.db.insurances);
        },
        perform_search: function (query) {
            var insurances = this.pos.db.search_insurances(query);
            this.render_list(insurances);
        },
        clear_search: function () {
            this.render_list(this.pos.db.insurances);
            var contents = this.$('.client-details-contents');
            contents.empty();
            this.old_insurance = null;
            this.$('.highlight').removeClass('highlight');
            this.$('.search-product input')[0].value = '';
        },
        render_list: function (insurances) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(insurances.length, 100); i < len; i++) {
                var insurance = insurances[i];
                var insurance_line_html = qweb.render('medical_insurance_row', {widget: this, insurance: insurance});
                var insurance_line = document.createElement('tbody');
                insurance_line.innerHTML = insurance_line_html;
                insurance_line = insurance_line.childNodes[1];
                this.insurances_cache.cache_node(insurance.id, insurance_line);
                if (insurance === this.old_insurance) {
                    insurance_line.classList.add('highlight');
                } else {
                    insurance_line.classList.remove('highlight');
                }
                contents.appendChild(insurance_line);
            }
        },
        insurance_selected: function (event, $line, id) {
            var insurance = this.pos.db.insurance_by_id[id];
            if ($line.hasClass('highlight')) {
                $line.removeClass('highlight');
                this.old_insurance = null;
                this.display_insurance('hide', insurance);
            } else {
                this.$('.highlight').removeClass('highlight');
                $line.addClass('highlight');
                this.old_insurance = insurance;
                this.display_insurance('show', insurance);
            }
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        save_insurance: function (event) {
            var self = this;
            var fields = {};
            this.$('.client-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['patient_name']) {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Field patient name is required'
                })
            }
            if (!fields['rate']) {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Field rate is required'
                })
            }
            if (!fields['medical_number']) {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Field medical number is required'
                })
            }
            fields['rate'] = parseFloat(fields['rate']);
            self.fields = fields;
            if (fields['id']) {
                rpc.query({
                    model: 'medical.insurance',
                    method: 'write',
                    args: [[parseInt(fields['id'])], fields],
                }).then(function (result) {
                    if (result == true) {
                        return rpc.query({
                            model: 'medical.insurance',
                            method: 'search_read',
                            domain: [['id', '=', self.fields['id']]],
                            fields: ['name', 'code', 'subscriber_id', 'patient_name', 'patient_number', 'rate', 'medical_number', 'employee', 'phone', 'product_id', 'insurance_company_id'],
                        }).then(function (insurances) {
                            var insurance = insurances[0];
                            self.pos.db.insurances = _.filter(self.pos.db.insurances, function (old_data) {
                                return old_data['id'] != insurance['id']
                            });
                            self.pos.db.save_insurances(insurances);
                            self.clear_search();
                        })
                    }
                }).fail(function (error) {
                    return self.pos.query_backend_fail(error);
                });
            } else {
                fields['subscriber_id'] = parseInt(fields['subscriber_id']);
                if (!fields['patient_number']) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Field patient number is required'
                    })
                }
                return rpc.query({
                    model: 'medical.insurance',
                    method: 'create',
                    args: [fields],
                }).then(function (medical_insurance_id) {
                    return rpc.query({
                        model: 'medical.insurance',
                        method: 'search_read',
                        domain: [['id', '=', medical_insurance_id]],
                        fields: ['name', 'code', 'subscriber_id', 'patient_name', 'patient_number', 'rate', 'medical_number', 'employee', 'phone', 'product_id', 'insurance_company_id'],
                    }).then(function (insurances) {
                        self.pos.db.save_insurances(insurances);
                        self.clear_search();
                        var insurance = insurances[0];
                        var order = self.pos.get_order();
                        if (insurance && order) {
                            if (insurance.subscriber_id) {
                                var client = self.pos.db.get_partner_by_id(insurance.subscriber_id[0]);
                                if (client) {
                                    order.set_client(client);
                                }
                            }
                            order.medical_insurance = insurance;
                            self.pos.gui.back();
                            self.pos.trigger('change:medical_insurance');
                        }
                    })
                }).fail(function (error) {
                    return self.pos.query_backend_fail(error);
                });
            }
        },
        display_insurance: function (visibility, insurance, clickpos) {
            var self = this;
            var contents = this.$('.client-details-contents');
            contents.empty();
            if (visibility == 'show') {
                contents.append($(qweb.render('medical_insurance_edit', {widget: this, insurance: insurance})));
                contents.find('.save').on('click', function (event) {
                    self.save_insurance(event);
                });
                contents.find('.print_medical_insure_card').on('click', function (event) {
                    if (!self.pos.config.iface_print_via_proxy) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Missing',
                            body: 'Function only supported installed posbox and printer'
                        })
                    }
                    var fields = {};
                    $('.client-details-contents .detail').each(function (idx, el) {
                        fields[el.name] = el.value || false;
                    });
                    var insurance_id = fields['id'];
                    var insurance = self.pos.db.insurance_by_id[insurance_id];
                    if (insurance && insurance['code']) {
                        var card = qweb.render('medical_insurance_card', {
                            insurance: insurance
                        });
                        self.pos.proxy.print_receipt(card);
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Printed card',
                            body: 'Please get card at your printer'
                        })
                    }
                });
                contents.find('.select_insurance').on('click', function (event) {
                    var fields = {};
                    $('.client-details-contents .detail').each(function (idx, el) {
                        fields[el.name] = el.value || false;
                    });
                    var insurance_id = fields['id'];
                    var insurance = self.pos.db.insurance_by_id[insurance_id];
                    var order = self.pos.get_order();
                    if (insurance && order) {
                        if (insurance.subscriber_id) {
                            var client = self.pos.db.get_partner_by_id(insurance.subscriber_id[0]);
                            if (client) {
                                order.set_client(client);
                            }
                        }
                        order.medical_insurance = insurance;
                        self.pos.gui.back();
                        self.pos.trigger('change:medical_insurance');
                    }
                });
                contents.find('.deselected_insurance').on('click', function (event) {
                    var order = self.pos.get_order();
                    if (insurance && order) {
                        order.medical_insurance = null;
                        self.clear_search()
                        self.pos.gui.back();
                        self.pos.trigger('change:medical_insurance')
                    }
                });
                contents.find('.create').on('click', function (event) {
                    var order = self.pos.get_order();
                    if (insurance && order) {
                        order.medical_insurance = null;
                        self.clear_search()
                        self.pos.gui.back();
                        self.pos.trigger('change:medical_insurance')
                    }
                });
                this.$('.client-details-contents').show();
            }
            if (visibility == 'hide') {
                this.$('.client-details-contents').hide();
            }
        },
    });
    gui.define_screen({name: 'medical_insurance_screen', widget: medical_insurance_screen});
});
