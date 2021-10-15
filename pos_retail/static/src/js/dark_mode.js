odoo.define('pos_retail.dark_mode', function (require) {
    var chrome = require('point_of_sale.chrome');
    var models = require('point_of_sale.models');

    var dark_mode_widget = chrome.StatusWidget.extend({
        template: 'dark_mode_widget',
        start: function () {
            var self = this;
            this.pos.bind('change:dark_mode', function (pos, datas) {
                self.set_status(datas.state, datas.pending);
            });
            this.$el.click(function () {
                if (self.pos.dark_mode) {
                    self.pos.set('dark_mode', {state: 'connected', pending: 0});
                    $('.pos').removeClass('dark');
                    $('.screen').removeClass('dark');
                    $('.paylater-list').removeClass('dark');
                } else {
                    self.pos.set('dark_mode', {state: 'connecting', pending: 0});
                    $('.pos').addClass('dark');
                    $('.screen').addClass('dark');
                    $('.paylater-list').addClass('dark');
                }
                self.pos.dark_mode = !self.pos.dark_mode;
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'dark_mode_widget',
                    'widget': dark_mode_widget,
                    'append': '.pos-branding'
                }
            );
            this._super();
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            this.dark_mode = false;
            _super_PosModel.initialize.call(this, session, attributes)
        },
    })

});
