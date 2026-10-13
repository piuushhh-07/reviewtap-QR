const points = [
  {
    title: 'Your printed code stays the same',
    description:
      'Each QR points to a ReviewTap redirect. Admins can update its saved review destination without reprinting.',
  },
  {
    title: 'Keep the white margin intact',
    description:
      "Don't crop the quiet border around the code or place a logo on top of it — both can stop phone cameras from reading it.",
  },
  {
    title: 'Always scan-test before you print',
    description:
      'Try it in the lighting you plan to use it in, from a normal arm\u2019s length, on more than one phone.',
  },
  {
    title: 'Show it to every customer',
    description:
      "Display the same code for everyone who's willing to leave one — don't offer it only to customers who seem happy, and don't offer a reward for scanning it.",
  },
]

export function GoodToKnow() {
  return (
    <section
      className="section section--alt"
      id="good-to-know"
      aria-labelledby="good-to-know-heading"
    >
      <div className="section__inner">
        <h2 id="good-to-know-heading">Before you print it</h2>
        <div className="good-to-know__grid">
          {points.map((point) => (
            <div className="good-to-know__item" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
