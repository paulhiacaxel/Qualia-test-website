import { ActionForm } from "@/components/host/action-form";
import { sendBookingMessage } from "@/app/bookings/actions";
import { formatMiamiDate } from "@/lib/host/validation";
import type { BookingMessage } from "@/lib/booking/types";

export function MessageThread({
  bookingId,
  messages,
  userId,
  hostId,
  hostName,
  guestName,
}: {
  bookingId: string;
  messages: BookingMessage[];
  userId: string;
  hostId: string;
  hostName: string;
  guestName: string;
}) {
  return (
    <section className="panel booking-conversation">
      <h2>Keep the conversation here.</h2>
      <p>Use this thread to discuss your experience with the other person in this booking.</p>
      <ol className="message-list">
        {messages.map((message) => (
          <li className={message.sender_id === userId ? "message-own" : ""} key={message.id}>
            <div className="message-meta">
              <strong>
                {message.sender_id === userId
                  ? "You"
                  : message.sender_id === hostId
                    ? hostName
                    : guestName}
              </strong>
              <time dateTime={message.created_at}>{formatMiamiDate(message.created_at)}</time>
            </div>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
      {!messages.length ? (
        <p className="booking-helper">No messages yet. Ask a question or say hello.</p>
      ) : null}
      <ActionForm action={sendBookingMessage} label="Send message">
        <input type="hidden" name="bookingId" value={bookingId} />
        <div>
          <label className="field-label" htmlFor="message-body">
            Your message
          </label>
          <textarea
            id="message-body"
            name="body"
            className="field-input field-textarea"
            rows={4}
            minLength={1}
            maxLength={3000}
            required
          />
        </div>
      </ActionForm>
    </section>
  );
}
