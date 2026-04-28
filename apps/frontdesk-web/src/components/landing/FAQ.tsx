import { Container } from "@/components/layout/Container"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { FAQ_ITEMS } from "@/contexts/constants/landing"

export function FAQ() {
  return (
    <section id="faq" className="bg-muted py-24 md:py-32">
      <Container>
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Common questions, honest answers.
          </h2>
        </div>

        <div className="mx-auto max-w-2xl">
          <Accordion multiple={false}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-foreground py-4">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  )
}
