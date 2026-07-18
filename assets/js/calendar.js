/* Qualia — reusable month calendar component (aperture-ring day cells). Attaches to window.QUALIA_CALENDAR */
(function(){

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['S','M','T','W','T','F','S'];

  function toISO(d){
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
  function daysInMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
  function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

  /**
   * create(container, opts)
   *  opts.dayState(dateObj, iso) -> 'available' | 'unavailable' | 'booked' | 'past' | 'blocked-toggle'
   *  opts.clickable(dateObj, iso, state) -> boolean
   *  opts.onSelect(iso, dateObj)
   *  opts.selected -> iso string currently selected/highlighted (optional)
   *  opts.minMonth -> Date, earliest month navigable to (defaults to current month)
   */
  function create(container, opts){
    opts = opts || {};
    var today = new Date(); today.setHours(0,0,0,0);
    var minMonth = opts.minMonth || startOfMonth(today);
    var state = { month: startOfMonth(opts.initialMonth || today), selected: opts.selected || null };

    function render(){
      var days = daysInMonth(state.month);
      var firstDow = new Date(state.month.getFullYear(), state.month.getMonth(), 1).getDay();
      var atMin = state.month.getFullYear() === minMonth.getFullYear() && state.month.getMonth() === minMonth.getMonth();

      var html = '';
      html += '<div class="cal-head">';
      html += '<button type="button" class="cal-nav-btn" data-cal-prev' + (atMin ? ' disabled style="opacity:.3;cursor:not-allowed;"' : '') + ' aria-label="Previous month">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      html += '<span class="font-display font-medium text-[16px]">' + MONTH_NAMES[state.month.getMonth()] + ' ' + state.month.getFullYear() + '</span>';
      html += '<button type="button" class="cal-nav-btn" data-cal-next aria-label="Next month">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      html += '</div>';

      html += '<div class="cal-grid mb-1">';
      DOW.forEach(function(d){ html += '<div class="cal-dow">' + d + '</div>'; });

      for (var i=0; i<firstDow; i++){ html += '<div class="cal-day empty"></div>'; }

      for (var day=1; day<=days; day++){
        var dateObj = new Date(state.month.getFullYear(), state.month.getMonth(), day);
        var iso = toISO(dateObj);
        var dayState = opts.dayState ? opts.dayState(dateObj, iso) : (dateObj < today ? 'past' : 'available');
        var clickable = opts.clickable ? opts.clickable(dateObj, iso, dayState) : (dayState === 'available');
        var classes = ['cal-day', dayState];
        if (isSameDay(dateObj, today)) classes.push('today');
        if (state.selected === iso) classes.push('selected');
        html += '<button type="button" class="' + classes.join(' ') + '" data-iso="' + iso + '"' + (clickable ? '' : ' tabindex="-1" aria-disabled="true"') + '>' + day + '</button>';
      }
      html += '</div>';

      container.innerHTML = html;

      container.querySelector('[data-cal-prev]').addEventListener('click', function(){
        if (atMin) return;
        state.month = addMonths(state.month, -1);
        render();
      });
      container.querySelector('[data-cal-next]').addEventListener('click', function(){
        state.month = addMonths(state.month, 1);
        render();
      });
      container.querySelectorAll('.cal-day:not(.empty)').forEach(function(btn){
        var iso = btn.getAttribute('data-iso');
        var dateObj = new Date(iso + 'T00:00:00');
        var dayState = opts.dayState ? opts.dayState(dateObj, iso) : null;
        var clickableNow = opts.clickable ? opts.clickable(dateObj, iso, dayState) : (dayState === 'available');
        if (clickableNow){
          btn.addEventListener('click', function(){
            if (opts.onSelect) opts.onSelect(this.getAttribute('data-iso'), new Date(this.getAttribute('data-iso') + 'T00:00:00'));
          });
        }
      });
    }

    render();
    return {
      render: render,
      setSelected: function(iso){ state.selected = iso; render(); },
      getMonth: function(){ return state.month; },
      goToMonth: function(d){ state.month = startOfMonth(d); render(); }
    };
  }

  window.QUALIA_CALENDAR = { create: create, toISO: toISO };

})();
