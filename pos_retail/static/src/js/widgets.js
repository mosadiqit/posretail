odoo.define('pos_retail.ribbon_widget', function (require) {

    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var _t = require('web.core')._t;

    var NewsWidget = PosBaseWidget.extend({
        template: 'NewsWidget',

        init: function (parent, options) {
            options = options || {};
            this.title = options.title;
            this.value = options.value;
            this._super(parent, options);
        },

        // events: {
        //     'click .button.cancel': 'click_cancel',
        //     'click .button.confirm': 'click_confirm',
        //     'click .selection-item': 'click_item',
        //     'click .input-button': 'click_numpad',
        //     'click .mode-button': 'click_numpad',
        // },

        // show the popup !
        show: function (options) {
            if (this.$el) {
                this.$el.removeClass('oe_hidden');
            }

            if (typeof options === 'string') {
                this.options = {title: options};
            } else {
                this.options = options || {};
            }

            this.renderElement();

            // popups block the barcode reader ...
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.save_callbacks();
                this.pos.barcode_reader.reset_action_callbacks();
            }
        },

        // called before hide, when a popup is closed.
        // extend this if you want a custom action when the
        // popup is closed.
        close: function () {
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },

        // hides the popup. keep in mind that this is called in
        // the initialization pass of the pos instantiation,
        // so you don't want to do anything fancy in here
        hide: function () {
            if (this.$el) {
                this.$el.addClass('oe_hidden');
            }
        },

        // what happens when we click cancel
        // ( it should close the popup and do nothing )
        click_cancel: function () {
            this.gui.close_popup();
            if (this.options.cancel) {
                this.options.cancel.call(this);
            }
        },

        // what happens when we confirm the action
        click_confirm: function () {
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this);
            }
        },

        // Since Widget does not support extending the events declaration
        // we declared them all in the top class.
        click_item: function () {
        },
        click_numad: function () {
        }
    });
    gui.define_popup({name: 'news', widget: NewsWidget});

});
