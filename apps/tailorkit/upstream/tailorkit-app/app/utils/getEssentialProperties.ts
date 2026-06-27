import type { Layer, NodeImage } from '~/types/psd'

export function getEssentialLayerProperties(layer: Layer) {
  const {
    _id,
    legacyName,
    psdId,
    width,
    height,
    blendingRanges,
    channels,
    channelsInfo,
    cols,
    visible,
    left,
    top,
    right,
    bottom,
    inforKeys,
    node,
    parent,
    type,
    // mask,
    image,
    optionSet,
    settings,
  } = layer

  return {
    _id,
    legacyName,
    psdId,
    width,
    height,
    blendingRanges,
    channels,
    channelsInfo,
    cols,
    visible,
    left,
    top,
    right,
    bottom,
    inforKeys,
    settings,
    // mask,
    children: (node._children || []).map(child => (typeof child === 'object' ? child.layer._id : child)),
    parent,
    type,
    image,
    optionSet,
  }
}

export function getEssentialImageProperties(image: NodeImage) {
  const {
    opacity,
    channelData,
    channelLength,
    channelsInfo,
    hasMask,
    _width: width,
    _height: height,
    src,
    _id,
    imageName,
  } = image

  return {
    opacity,
    channelData,
    channelLength,
    channelsInfo,
    imageName,
    hasMask,
    width: width || 0,
    height: height || 0,
    src,
    _id,
  }
}
