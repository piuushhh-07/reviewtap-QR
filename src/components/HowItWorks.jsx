const steps = [
  {
    title: 'Generate your QR codes',
    description:
      'Create unique, unassigned codes individually or in a batch and save them in your inventory.',
  },
  {
    title: 'Program each code',
    description:
      'Assign a code to a business and its validated Google review URL. Each code points to a dynamic redirect.',
  },
  {
    title: 'Print and update later',
    description:
      'Download PNG or SVG files, print batches, and update the business destination without changing its QR.',
  },
]

export function HowItWorks() {
  return (
    <section className="section" id="how-it-works" aria-labelledby="how-it-works-heading">
      <div className="section__inner">
        <h2 id="how-it-works-heading">How it works</h2>
        <ol className="steps">
          {steps.map((step, index) => (
            <li className="steps__item" key={step.title}>
              <span className="steps__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
