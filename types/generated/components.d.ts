import type { Schema, Struct } from '@strapi/strapi';

export interface SharedColoredText extends Struct.ComponentSchema {
  collectionName: 'components_shared_colored_texts';
  info: {
    displayName: 'colored-text';
    icon: 'brush';
  };
  attributes: {
    bold: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    color: Schema.Attribute.Enumeration<
      [
        'red',
        'blue',
        'green',
        'yellow',
        'gray',
        'black',
        'rgba(60,35,155,1)',
        'rgba(61,61,61,1)',
      ]
    >;
    text: Schema.Attribute.Blocks;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.colored-text': SharedColoredText;
    }
  }
}
