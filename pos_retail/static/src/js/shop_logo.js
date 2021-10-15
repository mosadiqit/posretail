"use strict";
odoo.define('pos_retail.shop_logo', function (require) {

    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var chrome = require('point_of_sale.chrome');
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        get_logo: function () { // return logo for posticket web and header top - right
            if (this.config.logo) {
                return 'data:image/png;base64, ' + this.config.logo
            } else {
                return 'data:image/png;base64, ' + this.company.logo
            }
        },
        initialize: function (session, attributes) {
            var load_company_logo = _.find(this.models, function (model) {
                return model['label'] == 'pictures';
            });
            load_company_logo.condition = function (self) {
                return self.config.logo == false;
            };
            var _super_load_company_logo_loaded = load_company_logo.loaded;
            load_company_logo.loaded = function (self) {
                _super_load_company_logo_loaded(self);
                console.log('load default company logo')
            };
            _super_PosModel.initialize.apply(this, arguments);
        }
    });

    var shop_logo_widget = PosBaseWidget.extend({
        template: 'shop_logo_widget',
        init: function (parent, options) {
            options = options || {};
            this._super(parent, options);
            this.action = options.action;
            this.label = options.label;
        },
        renderElement: function () {
            var self = this;
            this._super();
            if (self.pos.config.change_logo) {
                this.$el.click(function () {
                    self.pos.gui.show_popup('popup_change_logo', {
                        title: 'Change shop logo',
                        body: 'Are you want update shop logo',
                        confirm: function () {
                            var fields = {};
                            if (this.uploaded_picture) {
                                fields.image = this.uploaded_picture.split(',')[1];
                            }
                            if (fields.image) {
                                return rpc.query({
                                    model: 'pos.config',
                                    method: 'write',
                                    args: [[parseInt(self.pos.config.id)], {
                                        logo: fields.image
                                    }]
                                }).then(function () {
                                    return self.pos.reload_pos();
                                }, function (err) {
                                    self.pos.query_backend_fail(err);
                                });
                            }
                        }
                    })
                });
            }
        },
        show: function () {
            this.$el.removeClass('oe_hidden');
        },
        hide: function () {
            this.$el.addClass('oe_hidden');
        }
    });
    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets = _.filter(this.widgets, function (widget) {
                return widget['name'] != 'shop_logo_widget';
            });
            if (!this.pos.config.mobile_responsive) {
                this.widgets.push(
                    {
                        'name': 'shop_logo_widget',
                        'widget': shop_logo_widget,
                        'append': '.pos-rightheader'
                    }
                );
            }
            this._super();
        }
    });
    var popup_change_logo = PopupWidget.extend({
        template: 'popup_change_logo',
        show: function (options) {
            var self = this;
            this.uploaded_picture = null;
            this._super(options);
            var contents = this.$('.card');
            contents.scrollTop(0);
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.click_cancel();
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                        var logo_shop_header = $('.shop');
                        logo_shop_header.find('.logo_shop_header').remove();
                        logo_shop_header.append("<img src='" + res + "' class='logo_shop_header'>");
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
    gui.define_popup({name: 'popup_change_logo', widget: popup_change_logo});
});

