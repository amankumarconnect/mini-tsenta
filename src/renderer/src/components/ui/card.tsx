/**
 * Card Component (shadcn/ui)
 *
 * This file defines a set of Card components that together form a flexible card layout.
 * A "card" is a common UI pattern -- it is a bordered, rounded container used to group
 * related content together visually (like a profile card, a settings panel, a product tile, etc.).
 *
 * The Card is split into multiple sub-components for maximum flexibility:
 * - Card: The outer container/wrapper with border, shadow, and background.
 * - CardHeader: The top section, typically containing a title, description, and optional action.
 * - CardTitle: The main heading/title text inside the header.
 * - CardDescription: A smaller, muted description text below the title.
 * - CardAction: An optional action element (like a button) positioned in the header's top-right.
 * - CardContent: The main body/content area of the card.
 * - CardFooter: The bottom section, often containing action buttons or summary info.
 *
 * This component is part of shadcn/ui, a collection of accessible, customizable UI components
 * built with Radix UI primitives and styled with Tailwind CSS.
 *
 * Unlike Badge and Button, the Card does not use cva (class-variance-authority) because
 * it does not have multiple visual variants. It is a simple structural component with
 * fixed default styles that can be customized via the `className` prop.
 */

// Import the entire React library. This is required for JSX syntax (<div>, etc.)
// which gets compiled into React.createElement calls.
import * as React from 'react'

// Import the `cn` utility function from the project's local utils file.
// `cn` merges multiple CSS class strings together using `clsx` (conditional class joining)
// and `tailwind-merge` (resolving conflicting Tailwind utility classes). This allows
// users to pass custom `className` props that cleanly override default styles.
import { cn } from '@/lib/utils'

/**
 * Card Component
 *
 * The outermost container for a card layout. Renders a <div> with border, rounded corners,
 * shadow, and a flex-column layout with consistent spacing.
 *
 * Props:
 * - className (string): Optional additional CSS classes for customization.
 * - ...props: Any valid HTML <div> attributes (children, id, onClick, style, etc.).
 *
 * The type `React.ComponentProps<'div'>` means this component accepts all the same props
 * as a standard HTML <div> element.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card" is a custom data attribute used by shadcn/ui for component
      // identification. Other components and CSS selectors can target elements with
      // specific data-slot values (e.g., `has-data-[slot=card]`) to apply conditional styles.
      data-slot="card"
      className={cn(
        // === CARD BASE CLASSES ===
        // 'bg-card'             - Background color uses the theme's "card" color token
        //                         (usually white in light mode, dark gray in dark mode).
        // 'text-card-foreground' - Text color uses the theme's card foreground token,
        //                          ensuring good contrast against the card background.
        // 'flex'                - Display as a flex container (enables flexbox layout).
        // 'flex-col'            - Stack children vertically (column direction).
        // 'gap-6'               - Add 1.5rem (24px) spacing between each child element.
        // 'rounded-xl'          - Apply extra-large border radius (0.75rem / 12px) for
        //                         nicely rounded corners.
        // 'border'              - Add a 1px border around the card.
        // 'py-6'                - Add vertical padding of 1.5rem (24px) on top and bottom.
        // 'shadow-sm'           - Apply a small box shadow for subtle depth/elevation.
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
        // Merge any user-provided className, allowing customization/overrides.
        className
      )}
      // Spread all remaining props (children, id, onClick, aria-*, etc.) onto the <div>.
      {...props}
    />
  )
}

/**
 * CardHeader Component
 *
 * The header section of a card. Uses CSS Grid to lay out the title, description,
 * and an optional action element. The grid automatically adjusts its columns
 * when a CardAction is present.
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes.
 */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card-header" identifies this element as the card's header section.
      // This is used by other components' CSS selectors to detect and style accordingly.
      data-slot="card-header"
      className={cn(
        // === CARD HEADER CLASSES ===
        // '@container/card-header' - Makes this element a CSS container query context named
        //                            "card-header". This allows child elements to use
        //                            @container queries to adapt their layout based on the
        //                            header's width (responsive within the component itself).
        // 'grid'                   - Display as a CSS Grid container.
        // 'auto-rows-min'          - Each grid row is sized to fit its content (minimum height).
        // 'grid-rows-[auto_auto]'  - Explicitly define two grid rows, both auto-sized.
        //                            This accommodates the title row and description row.
        // 'items-start'            - Align grid items to the top (start) of their grid area.
        // 'gap-2'                  - Add 0.5rem (8px) spacing between grid items.
        // 'px-6'                   - Horizontal padding of 1.5rem (24px) on left and right.
        // 'has-data-[slot=card-action]:grid-cols-[1fr_auto]'
        //                          - If a child with data-slot="card-action" is present,
        //                            switch to a two-column grid: the first column takes up
        //                            all remaining space (1fr), and the second column auto-sizes
        //                            to fit the action element. This is a clever use of the
        //                            CSS :has() selector combined with data attributes.
        // '[.border-b]:pb-6'       - If the header has the class "border-b" (bottom border),
        //                            add bottom padding of 1.5rem (24px) for spacing.
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className
      )}
      {...props}
    />
  )
}

/**
 * CardTitle Component
 *
 * The title/heading of a card. Rendered as a <div> with semibold font weight
 * and tight leading (line height).
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes (children for the title text, etc.).
 */
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card-title" identifies this as the card's title element.
      data-slot="card-title"
      className={cn(
        // 'leading-none'  - Set line-height to 1 (no extra spacing above/below the text).
        //                   This keeps the title text tightly spaced.
        // 'font-semibold' - Set font weight to semibold (600) for emphasis.
        'leading-none font-semibold',
        className
      )}
      {...props}
    />
  )
}

/**
 * CardDescription Component
 *
 * A secondary, muted description text that typically appears below the CardTitle
 * in the CardHeader. Used for supplementary information or subtitles.
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes.
 */
function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card-description" identifies this as the card's description element.
      data-slot="card-description"
      className={cn(
        // 'text-muted-foreground' - Use the theme's "muted foreground" color, which is a
        //                           softer/lighter text color to visually de-emphasize
        //                           the description compared to the title.
        // 'text-sm'               - Set font size to small (0.875rem / 14px).
        'text-muted-foreground text-sm',
        className
      )}
      {...props}
    />
  )
}

/**
 * CardAction Component
 *
 * An optional action element (like a button, icon, or menu) that appears in the
 * top-right corner of the CardHeader. It is positioned using CSS Grid to always
 * occupy the second column, spanning both rows.
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes (children for the action content).
 */
function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card-action" identifies this as the card's action element.
      // The CardHeader uses `has-data-[slot=card-action]` to detect this element
      // and switch to a two-column grid layout when it is present.
      data-slot="card-action"
      className={cn(
        // 'col-start-2'      - Place this element in the second column of the grid
        //                       (the "auto" column created by the CardHeader's responsive grid).
        // 'row-span-2'       - Span across both grid rows (title row and description row),
        //                       so the action is vertically centered relative to both.
        // 'row-start-1'      - Start from the first row.
        // 'self-start'        - Align this element to the top of its grid area.
        // 'justify-self-end'  - Align this element to the right (end) of its grid area.
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className
      )}
      {...props}
    />
  )
}

/**
 * CardContent Component
 *
 * The main body/content area of the card. This is where the primary information,
 * forms, images, or other content goes.
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes.
 */
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  // Render a simple <div> with horizontal padding matching the card's other sections.
  return (
    <div
      // data-slot="card-content" identifies this as the card's content area.
      data-slot="card-content"
      className={cn(
        // 'px-6' - Horizontal padding of 1.5rem (24px) to match the header and footer padding.
        'px-6',
        className
      )}
      {...props}
    />
  )
}

/**
 * CardFooter Component
 *
 * The bottom section of a card, typically containing action buttons, links,
 * or summary information.
 *
 * Props:
 * - className (string): Optional additional CSS classes.
 * - ...props: Any valid HTML <div> attributes.
 */
function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // data-slot="card-footer" identifies this as the card's footer section.
      data-slot="card-footer"
      className={cn(
        // 'flex'            - Display as a flex container for horizontal layout.
        // 'items-center'    - Vertically center the flex children.
        // 'px-6'            - Horizontal padding of 1.5rem (24px) to match other sections.
        // '[.border-t]:pt-6' - If the footer has the class "border-t" (top border),
        //                      add top padding of 1.5rem (24px) for spacing between
        //                      the border and the content.
        'flex items-center px-6 [.border-t]:pt-6',
        className
      )}
      {...props}
    />
  )
}

// Export all Card sub-components so they can be imported and used together.
// Typical usage: <Card> <CardHeader> <CardTitle>Title</CardTitle> </CardHeader>
//                <CardContent>Body</CardContent> <CardFooter>Footer</CardFooter> </Card>
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
