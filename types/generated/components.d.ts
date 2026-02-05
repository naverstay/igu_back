import type { Schema, Struct } from '@strapi/strapi';

export interface SharedColoredText extends Struct.ComponentSchema {
  collectionName: 'components_shared_colored_texts';
  info: {
    displayName: 'CloredText';
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

export interface SharedContentBlock extends Struct.ComponentSchema {
  collectionName: 'components_shared_content_blocks';
  info: {
    displayName: 'ContentBlock';
    icon: 'book';
  };
  attributes: {
    artikels: Schema.Attribute.Relation<'oneToMany', 'api::artikel.artikel'>;
    content: Schema.Attribute.Blocks;
    textHTML: Schema.Attribute.Text;
    useTextHTML: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface SharedGalleryBlock extends Struct.ComponentSchema {
  collectionName: 'components_shared_gallery_blocks';
  info: {
    displayName: 'GalleryBlock';
    icon: 'apps';
  };
  attributes: {
    fullScreen: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    gallery_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::gallery-item.gallery-item'
    >;
    galleryId: Schema.Attribute.String;
    swiperOptions: Schema.Attribute.JSON;
  };
}

export interface SharedGalleryItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_gallery_items';
  info: {
    displayName: 'GalleryItem';
    icon: 'landscape';
  };
  attributes: {
    description: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.colored-text': SharedColoredText;
      'shared.content-block': SharedContentBlock;
      'shared.gallery-block': SharedGalleryBlock;
      'shared.gallery-item': SharedGalleryItem;
    }
  }
}
