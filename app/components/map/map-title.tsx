export function MapTitle({ title }: { title: string }) {
  return (
    <div className="map-title-group" aria-hidden="true">
      <div className="map-title-laurel" />
      <svg className="map-title-cartouche" viewBox="0 0 420 94">
        <path d="M48 18H372L402 47L372 76H48L18 47Z" />
        <path d="M52 25H368L389 47L368 69H52L31 47Z" />
        <path d="M72 18C61 4 48 4 39 14M348 18C359 4 372 4 381 14M72 76C61 90 48 90 39 80M348 76C359 90 372 90 381 80" />
        <text x="210" y="54">{title.toLocaleUpperCase("it-IT")}</text>
      </svg>
    </div>
  );
}