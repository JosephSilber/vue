var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var isRange = el.type === 'range'

    // check params
    // - lazy: update model on "change" instead of "input"
    var lazy = this._checkParam('lazy') != null
    // - number: cast value into number when updating model.
    var number = this._checkParam('number') != null
    // - debounce: debounce the input listener
    var debounce = parseInt(this._checkParam('debounce'), 10)

    // handle composition events.
    //   http://blog.evanyou.me/2014/01/03/composition-event/
    // skip this for Android because it handles composition
    // events quite differently. Android doesn't trigger
    // composition events for language input methods e.g.
    // Chinese, but instead triggers them for spelling
    // suggestions... (see Discussion/#162)
    var composing = false
    if (!_.isAndroid && !isRange) {
      this.onComposeStart = function () {
        composing = true
      }
      this.onComposeEnd = function () {
        composing = false
        // in IE11 the "compositionend" event fires AFTER
        // the "input" event, so the input handler is blocked
        // at the end... have to call it here.
        self.listener()
      }
      _.on(el, 'compositionstart', this.onComposeStart)
      _.on(el, 'compositionend', this.onComposeEnd)
    }

    // prevent messing with the input when user is typing,
    // and force update on blur.
    this.focused = false
    if (!isRange) {
      this.onFocus = function () {
        self.focused = true
      }
      this.onBlur = function () {
        self.focused = false
        self.listener()
      }
      _.on(el, 'focus', this.onFocus)
      _.on(el, 'blur', this.onBlur)
    }

    // Now attach the main listener
    this.listener = function () {
      if (composing) return
      var val = number || isRange
        ? _.toNumber(el.value)
        : el.value
      self.set(val)
      // force update here, because the watcher may not
      // run when the value is the same.
      _.nextTick(function () {
        self.update(self._watcher.value)
      })
    }
    if (debounce) {
      this.listener = _.debounce(this.listener, debounce)
    }

    // Support jQuery events, since jQuery.trigger() doesn't
    // trigger native events in some cases and some plugins
    // rely on $.trigger()
    //
    // We want to make sure if a listener is attached using
    // jQuery, it is also removed with jQuery, that's why
    // we do the check for each directive instance and
    // store that check result on itself. This also allows
    // easier test coverage control by unsetting the global
    // jQuery variable in tests.
    this.hasjQuery = typeof jQuery === 'function'
    if (this.hasjQuery) {
      jQuery(el).on('change', this.listener)
      if (!lazy) {
        jQuery(el).on('input', this.listener)
      }
    } else {
      _.on(el, 'change', this.listener)
      if (!lazy) {
        _.on(el, 'input', this.listener)
      }
    }

    // IE9 doesn't fire input event on backspace/del/cut
    if (!lazy && _.isIE9) {
      this.onCut = function () {
        _.nextTick(self.listener)
      }
      this.onDel = function (e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
          self.listener()
        }
      }
      _.on(el, 'cut', this.onCut)
      _.on(el, 'keyup', this.onDel)
    }

    // set initial value if present
    if (
      el.hasAttribute('value') ||
      (el.tagName === 'TEXTAREA' && el.value.trim())
    ) {
      this._initValue = number
        ? _.toNumber(el.value)
        : el.value
    }
  },

  update: function (value) {
    if (!this.focused) {
      this.el.value = _.toString(value)
    }
  },

  unbind: function () {
    var el = this.el
    if (this.hasjQuery) {
      jQuery(el).off('change', this.listener)
      jQuery(el).off('input', this.listener)
    } else {
      _.off(el, 'change', this.listener)
      _.off(el, 'input', this.listener)
    }
    if (this.onComposeStart) {
      _.off(el, 'compositionstart', this.onComposeStart)
      _.off(el, 'compositionend', this.onComposeEnd)
    }
    if (this.onCut) {
      _.off(el, 'cut', this.onCut)
      _.off(el, 'keyup', this.onDel)
    }
    if (this.onFocus) {
      _.off(el, 'focus', this.onFocus)
      _.off(el, 'blur', this.onBlur)
    }
  }
}
