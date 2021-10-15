odoo.define('pos_retail.camera_scan_barcode', function (require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');

    var liveStreamConfig = {
        inputStream: {
            type: "LiveStream",
            constraints: {
                width: {min: 640},
                height: {min: 480},
                aspectRatio: {min: 1, max: 100},
                facingMode: "environment" // or "user" for the front camera
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: (navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4),
        decoder: {
            "readers": [
                {"format": "ean_reader", "config": {}}
            ]
        },
        locate: true
    };
    var fileConfig = $.extend(
        {},
        liveStreamConfig,
        {
            inputStream: {
                size: 800
            }
        }
    );

    chrome.Chrome.include({
        init_camera: function () {
            var self = this;
            try {
                Quagga.init(
                    liveStreamConfig,
                    function (err) {
                        if (err) {
                            $('.card-issue').html('<div class="alert alert-danger"><strong><i class="fa fa-exclamation-triangle"></i> ' + err.name + '</strong>: ' + err.message + '</div>');
                            Quagga.stop();
                            return;
                        }
                        Quagga.start();
                        self.pos.gui.show_popup('dialog', {
                            title: 'Succeed',
                            body: 'Your camera device ready for scanning barcode now',
                            color: 'success'
                        })
                    }
                );
            } catch (e) {
                console.warn(e);
                alert("Your Camera Device not ready scanning barode. This future only support SSL (https). Please setup your Odoo within ssl")
            }
        },
        add_camera_scan_barcode_event: function () {
            if (this.camera_registered) {
                return
            }
            var self = this;
            Quagga.onProcessed(function (result) {
                var drawingCtx = Quagga.canvas.ctx.overlay,
                    drawingCanvas = Quagga.canvas.dom.overlay;

                if (result) {
                    if (result.boxes) {
                        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                        result.boxes.filter(function (box) {
                            return box !== result.box;
                        }).forEach(function (box) {
                            Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                        });
                    }

                    if (result.box) {
                        Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                    }

                    if (result.codeResult && result.codeResult.code) {
                        Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {
                            color: 'red',
                            lineWidth: 3
                        });
                    }
                }
            });

            // Once a barcode had been read successfully, stop quagga and
            // close the modal after a second to let the user notice where
            // the barcode had actually been found.
            Quagga.onDetected(function (result) {
                if (result.codeResult.code) {
                    var code = result.codeResult.code;
                    console.log('camera scanned code: ' + code);
                    self.pos.gui.play_sound('bell');
                    self.pos.gui.show_popup('dialog', {
                        title: 'Scanned',
                        body: code,
                        color: 'success'
                    });
                    Quagga.stop();
                    self.pos.barcode_reader.scan(code);
                    setTimeout(function () {
                        self.init_camera();
                    }, 5000)
                }
            });
            this.camera_registered = true;
        },
        build_widgets: function () {
            this._super();
            if (this.pos.config.barcode_scan_with_camera) {
                this.init_camera();
                this.add_camera_scan_barcode_event();
            }
        }
    });

});
