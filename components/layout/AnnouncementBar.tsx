const messages = [
  "NO ADVANCE PAYMENT NO WORK",
  "5% OFF ON 5,000 ft WORK",
  "ONLY SERVICE AVAILABLE IN GUJRANWALA",
];

export function AnnouncementBar() {
  const line = messages.join("  |  ");
  const loop = `${line}  |  ${line}  |  `;

  return (
    <div className="announce-bar" role="region" aria-label="Announcements">
      <div className="announce-track">
        <span className="announce-text">{loop}</span>
        <span className="announce-text" aria-hidden>
          {loop}
        </span>
      </div>
    </div>
  );
}
