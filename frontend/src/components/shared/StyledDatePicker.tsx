import DropdownField from './DropdownField';
import { manilaTodayForPicker } from '../../utils/dateTime';
import { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { colors, fontSize, fontWeight, input, radius, shadows, zIndex } from '../../styles/tokens';

interface StyledDatePickerProps {
  browsing?: boolean;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function StyledDatePicker({
  value,
  browsing = false,
  onChange,
  placeholder = 'Select a date',
  disabled = false,
  required = false,
  className = '',
}: StyledDatePickerProps) {
  // Calculate min date (today + 3 days)
  const minDate = useMemo(() => {
    const today = manilaTodayForPicker();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setDate(today.getDate() + 3);
    return min;
  }, []);

  // Disable Sundays (day 0)
  const isDateDisabled = (date: Date) => {
    return date.getDay() === 0 || date < minDate;
  };

  // Custom day class name for styling
  const dayClassName = (date: Date) => {
    const isSunday = date.getDay() === 0;
    const isBeforeMin = date < minDate;
    
    if (isSunday || isBeforeMin) {
      return 'react-datepicker__day--disabled-custom';
    }
    return '';
  };

  return (
    <div className={`styled-date-picker-wrapper ${className}`} style={{ width: '100%' }}>
      <DatePicker
        selected={value}
        onChange={onChange}
        minDate={browsing ? undefined : minDate}
        filterDate={(date) => browsing || !isDateDisabled(date)}
        placeholderText={placeholder}
        disabled={disabled}
        required={required}
        dayClassName={browsing ? undefined : dayClassName}
        calendarClassName="custom-calendar"
        wrapperClassName="custom-wrapper"
        popperClassName="custom-popper"
        popperPlacement="top-start"
        showPopperArrow={false}
        dateFormat="MMMM d, yyyy"
        isClearable
        clearButtonClassName="clear-button"
        // Custom header with month and year pickers
        renderCustomHeader={({
          monthDate,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
          changeYear,
          changeMonth,
        }) => {
          const currentYear = monthDate.getFullYear();
          const currentMonth = monthDate.getMonth();
          
          // Generate year options (current year - 5 to current year + 5)
          const yearOptions = [];
          const minYear = manilaTodayForPicker().getFullYear();
          const maxYear = minYear + 5;
          for (let year = minYear; year <= maxYear; year++) {
            yearOptions.push(year);
          }
          
          // Month names
          const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          
          return (
            <div className="custom-header">
              <button
                type="button"
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                className="nav-button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              
              <div className="picker-controls">
                {/* Month Picker */}
                <DropdownField portal menuMinWidth={180} nowrapOptions selectedLabel={months[currentMonth].slice(0, 3)} placeholder="Month" value={String(currentMonth)} onChange={value => changeMonth(Number(value))} options={months.map((month, index) => ({label: month, value: String(index)}))} className="min-w-0 flex-1" />
                
                {/* Year Picker */}
                <DropdownField portal menuMinWidth={112} nowrapOptions placeholder="Year" value={String(currentYear)} onChange={value => changeYear(Number(value))} options={yearOptions.map(year => ({label: String(year), value: String(year)}))} className="min-w-0 flex-1" />
              </div>
              
              <button
                type="button"
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                className="nav-button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          );
        }}
        // Custom input
        customInput={
          <input
            type="text"
            className="styled-input"
            placeholder={placeholder}
            readOnly
          />
        }
      />
      
      {/* Custom CSS for the date picker */}
      <style>{`
        .styled-date-picker-wrapper {
          position: relative;
          width: 100%;
        }
        
        /* Input Field */
        .styled-input {
          width: 100%;
          height: ${input.height};
          padding: ${input.paddingY} 2.5rem ${input.paddingY} ${input.paddingX};
          font-size: ${fontSize.base};
          color: ${input.textColor};
          background-color: ${input.background};
          border: 1px solid ${input.borderColor};
          border-radius: ${input.radius};
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: ${input.shadow};
        }
        
        .styled-input:hover:not(:disabled) {
          border-color: ${colors.primary.DEFAULT};
        }
        
        .styled-input:focus {
          outline: none;
          border-color: ${colors.primary.DEFAULT};
          box-shadow: ${input.shadowFocus};
        }
        
        .styled-input::placeholder {
          color: ${input.placeholderColor};
        }
        
        .styled-input:disabled {
          background-color: ${input.backgroundDisabled};
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        /* React DatePicker Input Styling */
        .react-datepicker__input-container {
          width: 100%;
        }
        
        .react-datepicker__input-container input {
          width: 100% !important;
          height: ${input.height};
          padding: ${input.paddingY} 2.5rem ${input.paddingY} ${input.paddingX};
          font-size: ${fontSize.base};
          color: ${input.textColor};
          background-color: ${input.background};
          border: 1px solid ${input.borderColor};
          border-radius: ${input.radius};
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: ${input.shadow};
        }
        
        .react-datepicker__input-container input:hover:not(:disabled) {
          border-color: ${colors.primary.DEFAULT};
        }
        
        .react-datepicker__input-container input:focus {
          outline: none;
          border-color: ${colors.primary.DEFAULT};
          box-shadow: ${input.shadowFocus};
        }
        
        .react-datepicker__input-container input::placeholder {
          color: ${input.placeholderColor};
        }
        
        .react-datepicker__input-container input:disabled {
          background-color: ${input.backgroundDisabled};
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .react-datepicker-wrapper {
          width: 100%;
        }
        
        .custom-wrapper {
          width: 100%;
        }
        
        /* Calendar Container */
        .custom-calendar {
          font-family: inherit;
          border: 1px solid ${colors.gray[200]};
          border-radius: ${radius.lg};
          box-shadow: ${shadows.modal};
          background: ${colors.background.white};
          padding: 0.5rem 0.375rem;
          width: 280px !important;
          min-width: 280px !important;
          max-width: 280px !important;
          box-sizing: border-box;
        }
        
        .custom-calendar .react-datepicker__month-container {
          width: 100% !important;
          float: none !important;
        }
        
        .custom-calendar .react-datepicker__month {
          width: 100% !important;
          margin: 0 !important;
        }
        
        .custom-calendar .react-datepicker__week {
          display: flex !important;
          justify-content: space-between;
          width: 100% !important;
          gap: 0;
        }
        
        .custom-calendar .react-datepicker__day-names {
          display: flex !important;
          justify-content: space-between;
          width: 100% !important;
          gap: 0;
          margin-bottom: 0.5rem;
        }
        
        /* Popper positioning fixes */
        .react-datepicker-popper {
          z-index: ${zIndex.datepicker} !important;
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
        }
        
        .react-datepicker-popper[data-placement^="top"] {
          transform: translate(-50%, -60%) !important;
        }
        
        .react-datepicker-popper[data-placement^="bottom"] {
          transform: translate(-50%, -40%) !important;
        }
        
        .custom-popper {
          z-index: 9999;
          width: auto !important;
          max-width: 280px !important;
        }
        
        .custom-popper .react-datepicker {
          width: 100%;
          max-width: 280px;
        }
        
        /* Custom Header */
        .custom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.375rem 0.5rem;
          margin-bottom: 0.5rem;
        }
        
        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border: none;
          border-radius: ${radius.sm};
          background: ${colors.gray[100]};
          color: ${colors.gray[700]};
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .nav-button:hover:not(:disabled) {
          background: ${colors.primary.DEFAULT};
          color: ${colors.background.white};
        }
        
        .nav-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        /* Picker Controls Container */
        .picker-controls {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          flex: 1;
          justify-content: center;
        }
        
        /* Month Picker */
        .month-picker {
          padding: 0.25rem 0.375rem;
          font-size: ${fontSize.sm};
          font-weight: 500;
          color: ${colors.text.primary};
          background-color: ${colors.background.white};
          border: 1px solid ${colors.gray[200]};
          border-radius: ${radius.sm};
          cursor: pointer;
          transition: all 0.2s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.25rem center;
          padding-right: 1.25rem;
          min-width: 90px;
        }
        
        .month-picker:hover {
          border-color: ${colors.primary.DEFAULT};
        }
        
        .month-picker:focus {
          outline: none;
          border-color: ${colors.primary.DEFAULT};
          box-shadow: 0 0 0 2px ${colors.primary.ring};
        }
        
        /* Year Picker */
        .year-picker {
          padding: 0.25rem 0.375rem;
          font-size: ${fontSize.sm};
          font-weight: 500;
          color: ${colors.text.primary};
          background-color: ${colors.background.white};
          border: 1px solid ${colors.gray[200]};
          border-radius: ${radius.sm};
          cursor: pointer;
          transition: all 0.2s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.25rem center;
          padding-right: 1.25rem;
          min-width: 65px;
        }
        
        .year-picker:hover {
          border-color: ${colors.primary.DEFAULT};
        }
        
        .year-picker:focus {
          outline: none;
          border-color: ${colors.primary.DEFAULT};
          box-shadow: 0 0 0 2px ${colors.primary.ring};
        }
        
        /* Old month-year text style (kept for reference but not used) */
        .month-year {
          font-weight: 600;
          font-size: 0.9375rem;
          color: #111827;
        }
        
        /* Weekday Headers */
        .react-datepicker__day-names {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        
        .react-datepicker__day-name {
          font-size: ${fontSize.xs};
          font-weight: ${fontWeight.semibold};
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: ${colors.gray[500]};
          padding: 0.125rem 0;
          text-align: center;
          flex: 1;
        }
        
        /* Days Grid */
        .react-datepicker__month {
          margin: 0;
        }
        
        .react-datepicker__week {
          display: flex;
          justify-content: space-between;
          gap: 0;
        }
        
        /* Individual Day */
        .react-datepicker__day {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 32px;
          margin: 0 !important;
          font-size: 0.75rem;
          font-weight: 500;
          color: #374151;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        
        .react-datepicker__day-name {
          font-size: 0.5625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #6b7280;
          padding: 0.125rem 0;
          text-align: center;
          width: 36px;
          box-sizing: border-box;
        }
        
        .react-datepicker__day:hover:not(.react-datepicker__day--disabled):not(.react-datepicker__day--selected) {
          background-color: #fee2e2;
          color: #800000;
        }
        
        /* Selected Day */
        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background-color: #800000 !important;
          color: white !important;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(128, 0, 0, 0.3);
        }
        
        /* Today */
        .react-datepicker__day--today {
          color: #800000;
          font-weight: 700;
          border: 1px solid #800000;
        }
        
        .react-datepicker__day--today.react-datepicker__day--selected {
          border-color: transparent;
        }
        
        /* Disabled Days (Sundays and before min date) */
        .react-datepicker__day--disabled,
        .react-datepicker__day--disabled-custom {
          color: #d1d5db !important;
          text-decoration: line-through;
          cursor: not-allowed;
          background: transparent !important;
        }
        
        .react-datepicker__day--disabled:hover,
        .react-datepicker__day--disabled-custom:hover {
          background: transparent !important;
          color: #d1d5db !important;
        }
        
        /* Sunday styling - make it more obvious */
        .react-datepicker__day--disabled-custom[data-day="0"] {
          background-color: #fef2f2 !important;
          color: #fca5a5 !important;
          text-decoration: line-through;
        }
        
        /* Outside month days */
        .react-datepicker__day--outside-month {
          color: #9ca3af;
          opacity: 0.5;
        }
        
        /* Clear button */
        .clear-button {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          border: none;
          border-radius: 9999px;
          background: #e5e7eb;
          color: #6b7280;
          cursor: pointer;
          font-size: 1rem;
          line-height: 1;
          transition: all 0.2s ease;
        }
        
        .clear-button:hover {
          background: #800000;
          color: white;
        }
        
        /* Popper positioning */
        .custom-popper {
          z-index: 100;
        }
        
        /* Animation for calendar opening */
        .react-datepicker-popper {
          animation: fadeInDown 0.2s ease-out;
        }
        
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Time picker styling (if enabled) */
        .react-datepicker__time-container {
          border-left-color: #e5e7eb;
        }
        
        .react-datepicker__time-box {
          border-radius: 0.5rem;
        }
        
        .react-datepicker__time-list-item {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        
        .react-datepicker__time-list-item--selected {
          background-color: #800000 !important;
        }
        
        .react-datepicker__time-list-item:hover:not(.react-datepicker__time-list-item--selected) {
          background-color: #fee2e2 !important;
          color: #800000 !important;
        }
      `}</style>
    </div>
  );
}
